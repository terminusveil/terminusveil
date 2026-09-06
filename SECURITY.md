# Security

Terminus Veil is a read-only desk. Visitors connect no wallet and the desk stores nothing about them beyond a covering in their own browser. It holds no user funds.

It runs one key: the Wire poster's, a dedicated wallet in the host's environment and in no file, holding gas ETH only, never $VEIL and never the house's funds. Its address and balance are printed on `/status`. If that key were taken, the holder could spend the gas and post figures to `TerminusWire` under the desk's poster address; posts cannot be edited or deleted, so the answer is a new poster, pasted and announced on `/status` and `/docs`. The job that signs, `/api/wire/post`, is the site's one authenticated write and is guarded by a shared secret. Both are in scope.

If you find something wrong, on the site, in the public reads under `/api/`, in the post route, or in `contracts/`, write to [@terminus_veil](https://x.com/terminus_veil) on X. Say what you found and how to reproduce it. We answer there.

`/.well-known/security.txt` carries the same contact.
