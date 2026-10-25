"""Turns pytest failures (JUnit XML) into GitHub annotations, readable from the run summary and the API."""
import sys
import xml.etree.ElementTree as ET

esc = lambda s: s.replace("%", "%25").replace("\r", "%0D").replace("\n", "%0A")
root = ET.parse(sys.argv[1]).getroot()
n = 0
for case in root.iter("testcase"):
    for bad in list(case.findall("failure")) + list(case.findall("error")):
        text = ((bad.get("message") or "") + "\n" + (bad.text or ""))[-3500:]
        print(f"::error title={case.get('name')}::{esc(text)}")
        n += 1
print(f"{n} échec(s)")
