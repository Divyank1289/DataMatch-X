import requests

with open('sample_data/source_employees.csv', 'rb') as src, \
     open('sample_data/target_employees.xml', 'rb') as tgt, \
     open('sample_data/mapping_csv_to_xml.json', 'rb') as mp:

    resp = requests.post(
        'http://127.0.0.1:8000/api/compare',
        files={
            'source':  ('source_employees.csv',  src, 'text/csv'),
            'target':  ('target_employees.xml',   tgt, 'application/xml'),
            'mapping': ('mapping_csv_to_xml.json', mp, 'application/json'),
        }
    )

data = resp.json()
if resp.status_code == 200:
    s = data['summary']
    print("Report ID   :", data['report_id'])
    print("Source rows :", s['total_source_rows'])
    print("Target rows :", s['total_target_rows'])
    print("Matched     :", s['matched_rows'])
    print("Mismatched  :", s['mismatched_rows'])
    print("Source only :", s['source_only_rows'])
    print("Target only :", s['target_only_rows'])
    print("Match rate  :", str(s['match_rate_pct']) + "%")
    print()
    print("--- Mismatched rows ---")
    for r in data['results']:
        if r['status'] == 'mismatch':
            bad = [d for d in r['diffs'] if not d['matched']]
            cols = ', '.join(d['column'] + " [" + str(d['source_value']) + " -> " + str(d['target_value']) + "]" for d in bad)
            print("  " + str(r['key']) + ": " + cols)
    print()
    print("--- Source-only rows ---")
    for r in data['results']:
        if r['status'] == 'source_only':
            print("  " + str(r['key']))
    print("--- Target-only rows ---")
    for r in data['results']:
        if r['status'] == 'target_only':
            print("  " + str(r['key']))
else:
    print("ERROR:", resp.status_code, data)
