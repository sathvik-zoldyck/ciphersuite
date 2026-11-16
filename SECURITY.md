# Security policy

CipherSuite is used to store security findings, so we take reports about its own security seriously.

## Reporting a vulnerability

Please **do not open a public issue** for a vulnerability.

Use GitHub's private reporting instead: go to the repository's **Security** tab and choose **Report a vulnerability**. Include the affected version or commit, steps to reproduce, and the impact you expect. We aim to acknowledge reports within 5 working days and will keep you updated until a fix ships. We are happy to credit you in the release notes.

## Supported versions

Only the latest commit on `main` receives security fixes.

## Running your own deployment safely

CipherSuite is self-hosted, so some protections depend on how you deploy it:

- **Deploy the security rules.** `firestore.rules` and `storage.rules` restrict every project, finding and evidence file to its owner. Run `firebase deploy --only firestore:rules,storage` whenever they change.
- **Keep `GEMINI_API_KEY` server-side.** Never prefix it with `NEXT_PUBLIC_`.
- **Limit AI spend.** The AI features run as Next.js server actions. Anyone who can reach your deployment can call them, so set a quota or budget alert on your Gemini API key, and put the app behind your own access control if it is exposed to the internet.
- **Restrict your Firebase web API key** to your app's domains in the Google Cloud console. The key is public by design, but restricting it limits abuse.
- **Guest mode stores data in the browser's localStorage.** Anyone with access to that browser profile can read it.
