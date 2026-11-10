import importlib.util
from pathlib import Path
import unittest
spec = importlib.util.spec_from_file_location('resolve_version', Path(__file__).resolve().parents[1] / 'tools/resolve_version.py')
v = importlib.util.module_from_spec(spec)
spec.loader.exec_module(v)


class VersionTests(unittest.TestCase):
    def test_page_rejects_ambiguous_or_missing_versions(self):
        self.assertEqual(v.package_version('__webglProductVersion="4.0.51"; __webglProductVersion="4.0.51";'), '4.0.51')
        for html in ['', '__webglProductVersion="4.0.51";__webglProductVersion="4.0.52";']:
            with self.assertRaises(ValueError):
                v.package_version(html)

    def test_uses_live_asset_index_instead_of_pinned_hash(self):
        index = {'assetInfos': [{'assetPath':'MyAssets/docs/version/version.json','ownerBundleIndex':0}, {'assetPath':'MyAssets/docs_version/version.json','ownerBundleIndex':1}], 'bundleInfos':[{'name':'wrong.majset'}, {'name':'changed_hash.majset'}]}
        self.assertEqual(v.find_version_bundle(index), 'changed_hash.majset')
        index['bundleInfos'][1]['name'] = '../../escape.majset'
        with self.assertRaises(ValueError):
            v.find_version_bundle(index)

    def test_rejects_other_platforms_and_unexpected_version_formats(self):
        self.assertEqual(v.validate_version({'version':'0.16.291','platform':'WebGL'}), '0.16.291')
        for value in [{'version':'0.16.291','platform':'Android'}, {'version':'latest','platform':'WebGL'}]:
            with self.assertRaises(ValueError):
                v.validate_version(value)

    def test_limits_downloads_and_redirects_to_official_origin(self):
        self.assertEqual(v.validate_url('https://game.maj-soul.com/assetbundles/index'), 'https://game.maj-soul.com/assetbundles/index')
        for url in ['http://game.maj-soul.com/', 'https://game.maj-soul.com.evil.test/', 'https://user@game.maj-soul.com/', 'https://game.maj-soul.com:444/']:
            with self.assertRaises(ValueError):
                v.validate_url(url)


if __name__ == '__main__':
    unittest.main()
