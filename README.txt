OVERLOAD LOG - offline app

Put these files on any free static host, open the address once on your phone,
then add it to your home screen. After that it opens and saves with no signal.

Files
  index.html              the app
  sw.js                   keeps the app on your phone for offline use
  manifest.webmanifest    name and icon for the home screen
  *.png                   icons

Publish on GitHub Pages (free)
  1. Sign in at github.com (or create a free account).
  2. Create a new public repository, for example "overload-log".
  3. On the repository page choose "uploading an existing file", drag in
     every file from this folder (not the folder itself), then Commit.
  4. Settings > Pages > Source: "Deploy from a branch", Branch: main, / (root). Save.
  5. After a minute your app is at https://YOUR-USERNAME.github.io/overload-log/

Install on your phone
  iPhone:  open the address in Safari > Share > Add to Home Screen.
  Android: open it in Chrome > menu > Install app (or Add to Home screen).
  Open it from the new icon once while online. The footer then says
  "ready to use offline".

Your data
  Logs are stored only on that phone, inside the installed app.
  Use "Export backup" in the footer now and then and keep the file somewhere safe.
  "Import backup" restores it on the same or a new phone.

Updating
  Replace index.html on the host. The phone picks up the new version in the
  background the next time the app opens online, and uses it from the open after that.
  If you change sw.js, also change VERSION at the top of it.
