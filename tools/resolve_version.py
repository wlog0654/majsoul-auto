"""Read current login versions from official Unity assets; never receives credentials."""
import io
import json
import re
import ssl
import sys
import time
import warnings
from pathlib import Path
from urllib.parse import urlsplit
from urllib.request import Request, build_opener, HTTPSHandler, HTTPRedirectHandler, ProxyHandler
import UnityPy

BASE = 'https://game.maj-soul.com'


def validate_url(url):
    parts = urlsplit(url)
    if parts.scheme != 'https' or parts.hostname != 'game.maj-soul.com' or parts.username or parts.password or parts.port not in (None, 443):
        raise ValueError('VERSION_UNTRUSTED_SOURCE')
    return url


class Redirects(HTTPRedirectHandler):
    def redirect_request(self, request, fp, code, message, headers, newurl):
        validate_url(newurl)
        return super().redirect_request(request, fp, code, message, headers, newurl)


def download(path):
    url = validate_url(BASE + path)
    url += ('&' if '?' in url else '?') + 'randv=' + str(time.time_ns())
    opener = build_opener(ProxyHandler(), HTTPSHandler(context=ssl.create_default_context()), Redirects())
    with opener.open(Request(url, headers={'Cache-Control': 'no-cache'}), timeout=25) as response:
        data = response.read(16 * 1024 * 1024 + 1)
    if len(data) > 16 * 1024 * 1024:
        raise ValueError('VERSION_RESOURCE_TOO_LARGE')
    return data


def package_version(html):
    values = set(re.findall(r'__webglProductVersion\s*=\s*[\"\'](\d+\.\d+\.\d+)[\"\']', html))
    if len(values) != 1:
        raise ValueError('VERSION_PAGE_FORMAT_CHANGED')
    return values.pop()


def find_version_bundle(info):
    matches = [item for item in info['assetInfos'] if item['assetPath'] == 'MyAssets/docs_version/version.json']
    if len(matches) != 1:
        raise ValueError('VERSION_ASSET_MAPPING_CHANGED')
    filename = info['bundleInfos'][matches[0]['ownerBundleIndex']]['name']
    if not re.fullmatch(r'[A-Za-z0-9_@$.-]+\.majset', filename) or '..' in filename:
        raise ValueError('VERSION_BUNDLE_PATH_INVALID')
    return filename


def validate_version(value):
    if value.get('platform') != 'WebGL' or not re.fullmatch(r'\d+\.\d+\.\d+', value.get('version', '')):
        raise ValueError('VERSION_RESOURCE_FORMAT_CHANGED')
    return value['version']


def resolve():
    page = download('/1/').decode('utf-8')
    package = package_version(page)
    # Unity strips the version from downloaded bundle headers. Match the engine
    # generation used by the current WebGL client; changed layouts fail closed.
    UnityPy.config.FALLBACK_UNITY_VERSION = '2022.3.62f2'
    with warnings.catch_warnings():
        warnings.simplefilter('ignore')
        env = UnityPy.load(io.BytesIO(download('/assetbundles/ASTC/bundle_info_so.majset')))
        mappings = [o.read_typetree() for o in env.objects if o.type.name == 'MonoBehaviour']
        info = next((m for m in mappings if m.get('m_Name') == 'BundleInfoSO'), None)
        if not info:
            raise ValueError('VERSION_BUNDLE_INDEX_CHANGED')
        filename = find_version_bundle(info)
        env = UnityPy.load(io.BytesIO(download('/assetbundles/ASTC/' + filename)))
        versions = []
        for obj in env.objects:
            if obj.type.name == 'TextAsset':
                asset = obj.read()
                if asset.m_Name == 'version':
                    versions.append(validate_version(json.loads(asset.m_Script)))
        if len(versions) != 1:
            raise ValueError('VERSION_RESOURCE_AMBIGUOUS')
    return {'resource': versions[0], 'package': package, 'platform': 'WebGL', 'source': 'Official Unity page and docs_version/version.json', 'resolved_at': int(time.time())}


def main():
    try:
        value = resolve()
        target = Path(sys.argv[1] if len(sys.argv) > 1 else 'work/current-client-version.json')
        target.parent.mkdir(parents=True, exist_ok=True)
        temporary = target.with_suffix('.tmp')
        temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')
        temporary.replace(target)
        message = f"自动读取官方版本成功：资源 {value['resource']}，程序包 {value['package']}。"
        print(message)
        import os
        if os.environ.get('GITHUB_STEP_SUMMARY'):
            with open(os.environ['GITHUB_STEP_SUMMARY'], 'a') as summary:
                summary.write(message + '\n')
    except Exception as error:
        # No credentials are present; still restrict logs to controlled codes.
        code = str(error) if re.fullmatch(r'VERSION_[A-Z_]+', str(error)) else 'VERSION_DISCOVERY_FAILED'
        print(f'自动读取版本失败：{code}。本次停止，不使用旧版本登录。', file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
