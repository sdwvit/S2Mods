---
name: eng-console-build-request
description: Request a console (Xbox) build of a published component by filing the vendor's support-desk form in Chrome. Covers producing and uploading the zip, which links the form needs, every form field, and the confirmation rules. Use when asked to prep for Xbox, request Xbox cooking, or send the cooking request form.
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
     token refresh itself and removes this step.
   - Do not file the request without a Drive link.
   - The link must be shareable (anyone with the link can view).

## The form

URL: https://zonekit-support.stalker2.com/hc/en-us/requests/new?ticket_form_id=37899381377297
The user is already signed in in Chrome; work in a new tab (see the chrome-browser skill).

| Field | Value |
|---|---|
| Issue category | `New mod / Mod update` (preselected by `ticket_form_id`) |
| How would you like us to address you? | `sdwvit` |
| Subject | `XBOX Mod Cooking Request` |
| Description | `Requesting Xbox cooking for the mod "<ModName>" by sdwvit. The zip is linked in the Google Drive field. Thanks!` |
| URL to Google Drive with a mod | the Drive link from `zip-for-xbox` |
| URL to mod's page on mod.io | `https://mod.io/g/stalker2/m/<slug>#description` |
| Malicious files or inappropriate content check* | checked |
| Reference confirmation* (no references to missing assets) | checked |
| Attachments | none |

The description is a rich-text editor: `form_input` does not stick, and clicking it by `ref`
can leave focus in Subject, so the typed text lands there (seen 2026-10-07). Scroll it into view,
take a screenshot, click inside the editor box by coordinates, then type. Verify Subject and
Description with a screenshot before asking to submit.
Fields below the fold (mod.io URL, both checkboxes, Submit) do not show in a top-level
`read_page`; locate them with `find`.

The two checkboxes are attestations. Tick them only when the user asked for the request to be
sent; if the mod's last cook logged missing-asset warnings, raise that before ticking
"Reference confirmation".

## Submitting

Submitting files a ticket with a third party. Fill the form, take a screenshot, show the user the
filled values and get an explicit yes before clicking **Submit**. After submitting, report the
new request number/URL (`/hc/en-us/requests/<id>`).

Reference ticket with the expected shape: https://zonekit-support.stalker2.com/hc/en-us/requests/110363
Support replies on the ticket once the Xbox build is uploaded to mod.io; nothing else is needed
from our side.
