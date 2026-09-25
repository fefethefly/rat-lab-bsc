"""Re-run a recorded local session and verify the exact neural actions and physics."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from server.brain import VENDOR
from session import replay
if len(sys.argv) != 2: raise SystemExit('Usage: .venv/bin/python scripts/verify_session.py data/<run-id>')
ok, details = replay(sys.argv[1])
print(details)
print('MATCH' if ok else 'MISMATCH')
raise SystemExit(0 if ok else 1)
