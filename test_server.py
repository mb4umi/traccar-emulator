# SPDX-License-Identifier: GPL-3.0-only
import unittest
from urllib.parse import parse_qs, urlsplit

from server import tracking_url


class TrackingUrlTests(unittest.TestCase):
    def test_traccar_config(self):
        link = ('org.traccar.client://config?'
                'url=https%3A%2F%2Fraceradar.de%2Fingest%2Fosmand'
                '&id=test-id_with-dash&accuracy=highest&distance=0'
                '&interval=10&buffer=true&stop_detection=false')
        self.assertEqual(tracking_url(link),
                         'https://raceradar.de/ingest/osmand?id=test-id_with-dash')

    def test_direct_url_still_works(self):
        self.assertEqual(tracking_url('https://raceradar.de/ingest/osmand?id=test&interval=10'),
                         'https://raceradar.de/ingest/osmand?id=test')

    def test_embedded_query_and_outer_override(self):
        link = ('org.traccar.client://config?'
                'url=https%3A%2F%2Fraceradar.de%2Fingest%2Fosmand%3Fid%3Dold%26custom%3Dyes'
                '&id=new')
        self.assertEqual(parse_qs(urlsplit(tracking_url(link)).query),
                         {'id': ['new'], 'custom': ['yes']})

    def test_invalid_targets_remain_rejected(self):
        for link in [
            'org.traccar.client://config?id=test',
            'org.traccar.client://other?url=https%3A%2F%2Fraceradar.de%2Fingest%2Fosmand',
            'org.traccar.client://config?url=https%3A%2F%2Fexample.com%2Fingest%2Fosmand',
            'org.traccar.client://config?url=http%3A%2F%2Fraceradar.de%2Fingest%2Fosmand',
            'org.traccar.client://config?url=https%3A%2F%2Fraceradar.de%2Fother',
            'org.traccar.client://config?url=https%3A%2F%2Fuser%40raceradar.de%2Fingest%2Fosmand',
        ]:
            with self.subTest(link=link), self.assertRaises(ValueError):
                tracking_url(link)


if __name__ == '__main__':
    unittest.main()
