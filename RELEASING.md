# Cutting a release

Releases are built and signed **locally**, not in CI — see the note at the
bottom. This is the full routine, in order. Skipping a step here is how
0.4.3 nearly shipped unsigned and how winget sat three versions behind.

1. **Bump the version** in three places, all of which must agree:
   - `package.json`
   - `src-tauri/tauri.conf.json`
   - `src-tauri/Cargo.toml`

   (`site/src/pages/Support.tsx` has a placeholder example string with the
   version baked in too — cosmetic, but keep it current.)

2. **Run the full check suite and read the real exit code**:

   ```bash
   npm run check
   echo "EXIT=$?"
   ```

   Never pipe this through `grep`/`head`/etc. and read *that* command's exit
   code — that was the exact mistake that let 0.4.3 ship with unaccented
   Italian/French/Spanish strings. If you must filter the output, redirect
   to a file first and check `$?` on the un-piped command, then read the
   file separately.

3. **Build, signed**:

   ```bash
   export TAURI_SIGNING_PRIVATE_KEY="$(cat ~/.tauri/pctweaker.key)"
   export TAURI_SIGNING_PRIVATE_KEY_PASSWORD=""
   npm run tauri build
   ```

   `tauri build` prints "A public key has been found, but no private key"
   and still **exits 0** if the key didn't load — the exit code alone does
   not prove signing worked. Always confirm the `.sig` files exist next to
   the installers:

   ```bash
   ls src-tauri/target/release/bundle/nsis/*.sig
   ls src-tauri/target/release/bundle/msi/*.sig
   ```

4. **Commit, tag, push**:

   ```bash
   git tag -a vX.Y.Z -m "PC Tweaker X.Y.Z"
   git push origin master
   git push origin vX.Y.Z
   ```

5. **Publish the GitHub Release**, including the `.sig` files and a
   `latest.json` for the updater (see `git log` on past releases for the
   exact `gh release create` invocation and the `latest.json` shape).

6. **Verify live**, not just "the command didn't error":

   ```bash
   # what installed apps actually poll.
   # The ?t= is not decoration: GitHub's CDN serves the previous release's
   # latest.json for a few minutes after publishing, so without it this
   # reads the old version and you go hunting a bug that isn't there.
   curl -sL "https://github.com/AurelioAvila/pc-tweaker-app/releases/latest/download/latest.json?t=$(date +%s)"

   # what the site's download button actually serves
   curl -sIL https://github.com/AurelioAvila/pc-tweaker-app/releases/latest/download/PCTweaker-Setup.exe
   ```

7. **Winget submits itself — do not also do it by hand.** The
   `Publish to winget` workflow (`.github/workflows/winget-publish.yml`)
   fires on `release: published` and opens the PR against
   `microsoft/winget-pkgs` for you, within a minute or two of the release
   going up.

   This step used to be manual, and the instruction to run `wingetcreate`
   here outlived the workflow that replaced it. Following both is how 1.6.5
   ended up with two open PRs for the same version (#427308 from the
   workflow, #427310 by hand) and one of them had to be closed as noise in
   someone else's repository.

   Confirm rather than assume — the workflow succeeding is not the same as
   the PR being merged:

   ```bash
   gh run list --limit 5 --json name,conclusion,headBranch
   gh pr list --repo microsoft/winget-pkgs      --search "AurelioAvila.PCTweaker X.Y.Z in:title" --state all      --json number,title,state
   ```

   Only fall back to `wingetcreate update AurelioAvila.PCTweaker --version
   X.Y.Z --urls <setup.exe url> --submit --token "$(gh auth token)"` if the
   workflow did not run or opened nothing.

   Softpedia and MajorGeeks have **no equivalent automation** — they're
   editorial listings on someone else's schedule, not a repo you can open a
   PR against. Don't try to script those; they update (or don't) on their
   own timeline.

8. **Update the site and the docs to match what actually shipped.** The
   download link itself is version-independent and needs no edit, which is
   exactly why this step gets forgotten — the *claims* around it go stale
   silently. Anything that states a number or a feature list has to be
   re-checked every release:

   - `site/src/i18n/dictionary.ts` — the pricing card ("N tweaks free,
     forever", "All N tweaks unlocked"), the FAQ answer listing what's free
     vs Pro, and the Support page's version placeholder.
   - `TERMS.md` **and** `backend/legal/TERMS.md` (keep the two byte-identical
     — they drift otherwise) — the free-tier tweak count in section 2.
   - `README.md` — the total tweak count and the free/Pro split.
   - `CHANGELOG.md` — the entry for this version.
   - The **Microsoft Store** listing description, which also states the tweak
     count. This is the one surface with no CLI: it lives in Partner Center
     and only Aurelio can edit it, so it is the one that drifts furthest.
     Everything above can be scripted; this has to be done by hand or left
     knowingly stale.

   Verify by counting from the source, not from memory:

   ```bash
   python -c "
   import re,io
   s=io.open('src-tauri/src/tweaks.rs',encoding='utf-8').read()
   b=re.split(r'RegistryTweak\s*\{', s)[1:]
   pro=sum(1 for x in b if re.search(r'requires_pro:\s*true', x))
   print('tweaks.rs:', len(b)-pro, 'free /', pro, 'Pro')
   print('...plus the module-level tweaks pushed in lib.rs list_tweaks()')
   "
   ```

   This was missed for 0.4.3 and 0.4.4: both shipped 42 tweaks while the
   site, README and both TERMS files still advertised "28 free / 36 total"
   from an earlier release.

## Why CI doesn't do any of this

The repo's GitHub Actions signing secrets are deliberately unset — Aurelio
does releases in a session with Claude, so local signing is the chosen
workflow, not a gap to fill. The tag-triggered Build workflow going red at
the signing step is expected here, not a regression. See the "releases are
cut locally" note in project memory for the full reasoning.

The Build workflow *does* still gate on `npm run check` and on the `.sig`
files actually existing (added after 0.4.3) — so a real regression in tests,
i18n, or a broken signing key still shows up as red, even though nothing
downstream of that runs in CI.
