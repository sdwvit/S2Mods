---
name: eng-console-build-request
description: Request a console (Xbox) build of a published component by filing the vendor's support-desk form in Chrome. Covers producing and uploading the zip, checking the upload with the Google Drive connector, which links the form needs, every form field, and the confirmation rules. Use when asked to prep for Xbox, request Xbox cooking, push a mod zip to Google Drive, or send the cooking request form.
---

# Console build request

Console builds are not made locally: the vendor cooks them from a zip, after a request on their
support desk. The request needs two public links, so it always comes after the PC publish.

## Prerequisites

1. **mod.io page.** Publish to mod.io first (`npm run publish-modio`, or `publish-platforms`,
   which runs mod.io, Steam and the zip step in order). The page URL is
   `https://mod.io/g/stalker2/m/<slug>`; `publish-modio` prints it ("mod.io publish complete ...").
2. **Google Drive link to the zip.** `npm run zip-for-xbox` (run with `S2_MOD=<ModName>` from the
   repo root, or from the mod folder) zips `Mods/<ModName>/raw/Stalker2` into `<ModName>.zip` at
   the repo root and uploads it with `src/upload-google-drive.mts`, which prints the Drive link.
   - Auth is usually a short-lived `GDRIVE_ACCESS_TOKEN` in `.env` (about an hour). When the
     upload fails with "Google Drive token expired ..." or "auth is not configured", ask the user
     to generate a new token at
     https://developers.google.com/oauthplayground/#step1&scopes=https://www.googleapis.com/auth/drive.file
     (Authorize APIs, then Exchange authorization code for tokens, copy the Access token).
     Put what they paste into `GDRIVE_ACCESS_TOKEN` in `.env`, delete
     `src/.gdrive.access-token.cache.json`, and rerun `zip-for-xbox`. The script's own
     interactive prompt only appears in a TTY, so an agent run never sees it.
   - Setting `GDRIVE_CLIENT_ID` + `GDRIVE_CLIENT_SECRET` + `GDRIVE_REFRESH_TOKEN` makes the
     token refresh itself and removes this step. `GDRIVE_REFRESH_TOKEN` alone does nothing: the
     script only refreshes when all three are set, otherwise it uses `GDRIVE_ACCESS_TOKEN`. A
     playground refresh token needs "Use your own OAuth credentials" (gear icon) with the same
     client ID/secret that go into `.env`.
   - Do not file the request without a Drive link.
   - The link must be shareable (anyone with the link can view). The script uploads into Drive
     folder `mods` (`GDRIVE_FOLDER_ID`), which is shared "anyone with the link: reader", so every
     zip in it inherits that.
   - **claude.ai Google Drive connector**: use it for checks, never for the upload. `create_file`
     can't read a local file; it takes the bytes inline as `base64Content`, so the agent has to
     retype the whole file. On 2026-10-24 a 52 KB zip (69K base64 chars) came out corrupted and
     Drive answered "The file content is not a valid base64 string", after ~100K tokens spent
     reading and retyping it. Asset-mod zips reach ~125 MB. When the token has expired, ask the
     user for a new one (above). It has no tool to set "anyone" sharing either (`share_file` only
     takes users, groups and Chat spaces). Check the result with it:
     1. `search_files` with `title contains '<ModName>.zip'` (the query field is `title`, not
        `name`). The script overwrites the same Drive file on every upload, so there is normally
        one match: check its `modifiedTime` is from this run (DecoupledRanks.zip: created
        2026-03-07, modified on each upload).
     2. `get_file_permissions` on it: a permission with type `anyone` and role `reader` means the
        link is shareable. Without one, ask the user to set "Anyone with the link" in Drive; don't
        file the request until it is.
     3. Put the file's `viewUrl` in the form's Drive field (same link the script printed).

## Check for an existing ticket first

Before filling the form, look for a ticket already filed for this mod. One ticket per mod: a mod
update goes as a reply on its existing ticket, never as a second request.

1. Open https://zonekit-support.stalker2.com/en-US/support/tickets in a new tab. The list needs
   sign-in: if the page shows a login form or no avatar top right, ask the user to sign in in that
   tab (never type their credentials), then reload.
2. Search the open tickets for the mod name. Subjects follow
   `XBOX Mod Cooking Request: <ModName>`; also check older ones with a different wording. Closed
   tickets don't count: a mod whose only tickets are closed gets a new request.
3. Found an open one: report its number, status and date to the user and ask whether to reply on
   it (new Drive link and mod.io link) or to file a new one anyway. Do nothing further without an
   answer. No open match: go on to the form, signed in.

## The form

URL: https://zonekit-support.stalker2.com/en-US/support/tickets/create (the old
`/hc/en-us/requests/new?ticket_form_id=...` Zendesk URL is a 404 since 2026-10-21). Work in a new
tab (see the chrome-browser skill). Signed out, the form asks for Name and Email itself; after the
ticket check above you are normally signed in, so those two rows of the table do not apply.

| Field | Value |
|---|---|
| Category dropdown (top) | `New mod / Mod update` (pick it first; the mod fields appear after) |
| Name* | `sdwvit` |
| Email* | ask the user (kept out of this public repo) |
| Subject* | `XBOX Mod Cooking Request: <ModName>` |
| Description* | `Requesting Xbox cooking for the mod "<ModName>" by sdwvit. The zip is linked in the Google Drive field. Thanks!` |
| Your Name (How would you like us to address you?) | `sdwvit` |
| URL to Google Drive with a mod* | the Drive link from `zip-for-xbox` |
| URL to mod's page on mod.io | `https://mod.io/g/stalker2/m/<slug>#description` |
| Malicious files or inappropriate content check* | checked |
| Reference confirmation* | now a text field: `Confirmed: the mod has no references to missing assets.` |
| Attachments | none |

The plain inputs take `form_input` (find them with `find`). The description is a rich-text
editor: `form_input` does not stick, so scroll it into view, click inside the editor box by
coordinates, then type. Click the checkbox by coordinates after scrolling, and zoom to confirm it
is ticked. Verify everything with screenshots before submitting.
Submitting shows only "Thank you for contacting us." with no request number; the confirmation
goes to the email.
When the user is signed in to the site (avatar top right), Name and Email are gone, a CCs field
appears above the Drive field, and submitting opens the ticket page with its number
(`/support/tickets/<id>`).

Quirks (2026-10-22):
- Clicks sent right after a navigation are ignored while the page hydrates. Screenshot first,
  then click the category dropdown.
- Picking the category reloads the field list (spinner in the dropdown). Screenshot again before
  typing: typing in the same batch once left the form collapsed without the mod fields, and only a
  reload fixed it.
- Typing the Subject opens an "Are you looking for this?" list under it, which pushes the
  Description down. Take a screenshot after the Subject before you click the editor.
- Leaving a filled form opens a "Leave site?" dialog that freezes the tab. Reload with
  `navigate` `force: true`, or work in a new tab.
- Several mods: one ticket per mod. Never resubmit one that went through, even to fix the subject.

The two checkboxes are attestations. Tick them only when the user asked for the request to be
sent; if the mod's last cook logged missing-asset warnings, raise that before ticking
"Reference confirmation".

## Submitting

Submitting files a ticket with a third party. When the user asked to release the mod on all
platforms (or for the Xbox request itself), that is the go-ahead: tick both attestations and click
**Submit** without asking again (user, 2026-10-24: "don't ask next time"). Otherwise show the
filled values and get an explicit yes first. Signed in, submitting opens the
new ticket's page: report its number. Signed out, the site shows no request number; report that it
went through and that the confirmation goes by email.

## Bug reports on the same form

Category `Support request` swaps the mod fields for: Operating System & Version, Hardware
Specifications (CPU/RAM/GPU), Issue Type* (`Bug` / `Question`) and an attachment box (up to
20 MB; `file_upload` onto the hidden "Uploader" input works). The description editor opens a
command list on `/`, so put long text in with a synthetic `paste` event carrying `text/html`
(javascript_tool) rather than typing it. Submitting with an attachment takes about 30 s.

Support replies on the ticket once the Xbox build is uploaded to mod.io; nothing else is needed
from our side.
