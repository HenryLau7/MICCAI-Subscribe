import json
import tempfile
import unittest
from pathlib import Path

from common import canonical_affiliation
from parse_satellite import build, parse_listing
from validate import validate

ROOT = Path(__file__).resolve().parents[1]


class ImporterTests(unittest.TestCase):
    def test_colocated_events_have_distinct_ids(self):
        events, _ = build(ROOT / 'data/raw/2026-09-19', ROOT / 'config/satellite-aliases.yaml')
        self.assertEqual(len(events), len({e['id'] for e in events}))
        for acronym in ('Mama-Synth', 'UUSIVC2026', 'SASHIMI', 'SynthOCT'):
            event = next(e for e in events if e['acronym'] == acronym)
            self.assertEqual(next(e for e in events if e['id'] == event['id'])['acronym'], acronym)

    def test_validation_rejects_duplicate_satellite_ids(self):
        bundle = json.loads((ROOT / 'data/processed/program.json').read_text())
        bundle['satellite'][1]['id'] = bundle['satellite'][0]['id']
        errors, _ = validate(bundle, [], [])
        self.assertTrue(any('duplicate satellite' in error for error in errors), errors)

    def test_universities_are_not_grouped_by_generic_department(self):
        for university in ('Shanghai Jiao Tong University', 'Tsinghua University', 'Fudan University'):
            with self.subTest(university=university):
                self.assertEqual(
                    canonical_affiliation('School of Biomedical Engineering, ' + university),
                    canonical_affiliation(university),
                )

    def test_unidentified_affiliations_keep_their_full_identity(self):
        self.assertNotEqual(canonical_affiliation('School of Computing, Alpha'),
                            canonical_affiliation('School of Computing, Beta'))
        self.assertEqual(canonical_affiliation('Institute of Cancer Research'), 'institute-of-cancer-research')

    def test_contact_link_is_not_an_event_website(self):
        listings = parse_listing(ROOT / 'data/raw/2026-09-19/workshops.html', 'workshop')
        self.assertIsNone(next(e for e in listings if e['acronym'] == 'iMIMIC')['url'])
        self.assertTrue(any(e['url'] and e['url'].startswith('https://') for e in listings))

    def test_validation_rejects_a_satellite_url_that_is_not_an_absolute_http_link(self):
        for url in ('/cdn-cgi/l/email-protection#7a', 'javascript:alert(1)',
                    'https://example.org/w\r\nBEGIN:VEVENT'):
            with self.subTest(url=url):
                bundle = json.loads((ROOT / 'data/processed/program.json').read_text())
                bundle['satellite'][0]['url'] = url
                errors, _ = validate(bundle, [], [])
                self.assertTrue(any('url' in error for error in errors), errors)

    def test_event_urls_only_accept_absolute_http_links(self):
        links = ['https://example.org/workshop', '/relative', 'javascript:alert(1)', 'https://example.org/\nBEGIN:VEVENT']
        rows = ''.join(f'<tr><td>E{i}</td><td><a href="{url}">Event</a></td></tr>' for i, url in enumerate(links))
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'listing.html'
            path.write_text('<table><tr><th>Acronym</th><th>Name</th></tr>' + rows + '</table>')
            listings = parse_listing(path, 'workshop')
        self.assertEqual([e['url'] for e in listings], [links[0], None, None, None])


if __name__ == '__main__':
    unittest.main()
