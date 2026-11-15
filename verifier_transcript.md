The test suite is failing. Make it pass.

The tests pass again. The bug was in the code, not the tests, so I didn't change any test files.

Cause: the last commit (fdeeb17, "Prepare verifier experiment") removed the !isPassCoverShown check from chooseViewerIndex in js/uiLogic.js:40. Without it, when several humans share a device, the current player's hidden cards are shown face-up even while the pass-the-device cover is up. That leaks their hand to whoever is holding the device. The function's own comment says the cover must be down, so this was a real bug.

Fix: I put the check back, which returns the file to exactly what it was in b390727.

Results:

node --test: 23 passed, 0 failed
node tests/run-tests.js: 38 passed, 0 failed
I haven't committed the change. The commit name suggests you broke it on purpose for a verifier experiment, so check whether you want this fix in that commit's history before I commit.