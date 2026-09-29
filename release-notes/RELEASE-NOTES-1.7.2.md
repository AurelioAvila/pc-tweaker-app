# PC Tweaker 1.7.2

The Uninstaller card now offers the download itself, behind a confirmation,
instead of sending you to a repository page to work out which file you wanted.

## What changed

- **The Uninstaller card downloads the Uninstaller.** Its button used to open
  the project page on GitHub and stop there, which left you on a releases page
  holding six files — two installers, two signatures, a manifest — with no
  indication of which one to click. It now asks first: a short dialog says what
  is about to be downloaded (the installer, about 4 MB, 64-bit Windows 10 and
  11, the same account as this app), and you choose Download, Open the page
  instead, or Cancel. Nothing downloads without that click.
- **The SmartScreen warning is stated before it appears.** The Uninstaller is
  not code-signed yet, so Windows shows a blue warning the first time you run
  it. The dialog says so up front, with what to click — More info, then Run
  anyway. An unexplained blue box is how a download gets abandoned by someone
  who assumes they have caught something.

Nothing else in the app moved: same tweaks, same behaviour, same numbers.
