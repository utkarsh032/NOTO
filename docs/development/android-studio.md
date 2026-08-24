# Android Studio

The mobile application is Expo / React Native. Most work on it needs nothing
but a terminal — Android Studio is for the native side: the emulator, Logcat,
the Gradle build, and reading native crashes.

## First, the thing that surprises people

`apps/mobile/android/` is **generated output, not source**. It is matched by
`android/` in the root `.gitignore` and not a single file in it is tracked by
git. Expo produces it from `apps/mobile/app.json` and the dependency list, with
`expo prebuild`.

That has two consequences:

- Anything you hand-edit in `android/` is lost the next time it is regenerated.
  Real changes go in `app.json` — package name, permissions, plugins, icons.
- If the native project ever gets into a bad state, deleting it is a valid fix.
  See [regenerating](#regenerating-the-native-project).

## Prerequisites

| Thing                    | Notes                                                                     |
| ------------------------ | ------------------------------------------------------------------------- |
| Android Studio           | Latest. Installed at `C:\Program Files\Android\Android Studio`            |
| JDK                      | Use the JetBrains Runtime bundled with Studio. Gradle 9.3.1 needs JDK 17+ |
| Android SDK              | At `%LOCALAPPDATA%\Android\Sdk`                                           |
| Node 20.19+ and pnpm 11+ | The Gradle build shells out to `node` — see below                         |

Run `pnpm install` at the repository root before anything else. Gradle resolves
`react-native` and the Expo plugins out of `node_modules`; without it the sync
fails immediately.

### Set ANDROID_HOME

Not currently set on this machine, and it is the most common first failure
(`SDK location not found`). In PowerShell, once:

```powershell
$sdk = "$env:LOCALAPPDATA\Android\Sdk"
$path = [Environment]::GetEnvironmentVariable('Path', 'User')
[Environment]::SetEnvironmentVariable('ANDROID_HOME', $sdk, 'User')
[Environment]::SetEnvironmentVariable('Path', "$path;$sdk\platform-tools;$sdk\emulator", 'User')
```

Open a new terminal and check:

```powershell
adb version
```

Android Studio itself does not need the variable — it writes
`android/local.properties` with an `sdk.dir` line on first sync. The command
line does need it.

### SDK components

Android Studio → **Settings → Languages & Frameworks → Android SDK**.

| Component                       | Status on this machine          |
| ------------------------------- | ------------------------------- |
| Android SDK Platform            | `android-37.0` installed        |
| Android SDK Build-Tools         | `36.0.0` installed              |
| Android SDK Platform-Tools      | installed (`adb`)               |
| Android Emulator + system image | `android-37.1` x86_64 installed |
| Android SDK Command-line Tools  | **not installed** — add it      |

Install the command-line tools: `sdkmanager` lives there, `expo-doctor` looks
for it, and `sdkmanager --licenses` is how you clear licence errors.

The NDK is not needed. Nothing in Noto compiles C++ — React Native and the Expo
modules arrive as prebuilt artifacts.

## Opening the project

Open **`d:\Projects\Noto\apps\mobile\android`**.

Not the repository root, and not `apps/mobile` — Android Studio looks for
`settings.gradle` in the folder you open, and it only exists in `android/`. Open
either of the others and you get a plain file browser with no Gradle sync.

The first sync downloads Gradle 9.3.1, the Android Gradle Plugin and the
dependency graph. Expect it to take a while. Later syncs are fast.

`settings.gradle` runs `node --print require.resolve(...)` to locate the React
Native and Expo Gradle plugins, so Android Studio must inherit a PATH containing
`node`. If Studio was already open when Node was installed, restart it — the
symptom is `Cannot run program "node"` during sync.

Keep editing the TypeScript in VS Code. Android Studio is a poor JavaScript
editor and the two do not conflict.

## Running it

There are always two moving parts: the **native app** built by Gradle, and
**Metro**, the JavaScript bundler that serves the app's code over port 8081.

### The short way

```powershell
pnpm --filter @noto/mobile android
```

That is `expo run:android`: it prebuilds if needed, builds with Gradle,
installs on the connected device or running emulator, and starts Metro. Use it
for the first run of the day and after any native change.

### From Android Studio

1. Start Metro in a terminal, from the repository root:

   ```powershell
   pnpm dev:mobile
   ```

2. Pick your device in the toolbar dropdown.
3. Press **Run** (`Shift+F10`).

The Run button only rebuilds the _native_ app. Once it is installed, editing
`.tsx` files reloads through Metro in about a second — do not press Run again.
You need it only after changing native dependencies, `app.json`, or anything
under `android/`.

## Setting up an emulator

**Device Manager** (right sidebar) → **Create Virtual Device** → pick a Pixel →
choose the `android-37.1` x86_64 image that is already downloaded → Finish, then
press play.

Confirm it registered:

```powershell
adb devices
# emulator-5554   device
```

The emulator reaches Metro on the host through `10.0.2.2`; Expo wires that up,
so there is nothing to configure.

## Running on a physical device

1. On the phone: **Settings → About phone**, tap **Build number** seven times,
   then **Developer options → USB debugging** on.
2. Plug it in over USB and accept the "Allow USB debugging?" prompt.
3. Check it registered:

   ```powershell
   adb devices
   # R58M12ABCDE   device      <- "unauthorized" means the prompt was missed
   ```

4. Run it exactly as with the emulator — `pnpm --filter @noto/mobile android`
   installs to whichever device `adb` lists.
5. If the app opens on a red _Could not connect to development server_ screen,
   forward the Metro port:

   ```powershell
   adb reverse tcp:8081 tcp:8081
   ```

Over Wi-Fi instead of a cable — **Developer options → Wireless debugging → Pair
device with pairing code**, then:

```powershell
adb pair 192.168.1.50:41234     # the port and code from the pairing dialog
adb connect 192.168.1.50:37000  # the port on the wireless debugging screen
```

## What a working app looks like

The launcher icon is **Noto**; the package is `com.noto.app`.

- It opens on the document list. On the very first launch the list is empty and
  a default workspace is created in on-device SQLite.
- **+** creates a document and pushes to the editor at `/document/[id]`.
- Documents survive killing and reopening the app — they live in `expo-sqlite`,
  not memory. Uninstalling, or clearing app data, wipes them.

A **Storage unavailable** screen means the SQLite driver failed to open. The
reason will be in the Metro terminal and in Logcat.

## Debugging

| Where                                   | What it shows                                                                   |
| --------------------------------------- | ------------------------------------------------------------------------------- |
| Metro terminal                          | JS errors, bundling failures. `r` reloads, `j` opens React Native DevTools      |
| Redbox in the app                       | The current JS exception, with a stack                                          |
| Logcat, filtered `package:com.noto.app` | Native crashes, SQLite errors, anything that kills the process                  |
| Dev menu                                | `Ctrl+M` on the emulator, shake a real device, or `adb shell input keyevent 82` |

Rule of thumb: if the app is showing you something, the answer is in Metro. If
it vanished or never started, the answer is in Logcat.

## Building an APK

From `apps/mobile/android`:

```powershell
.\gradlew.bat assembleDebug     # app\build\outputs\apk\debug\app-debug.apk
.\gradlew.bat assembleRelease   # app\build\outputs\apk\release\app-release.apk
```

Or **Build → Build Bundle(s) / APK(s) → Build APK(s)** in Studio.

Two things worth knowing:

- The **debug** APK contains no JavaScript bundle. It expects Metro to be
  reachable, so it is not something you can hand to someone else.
- The **release** APK embeds the bundle, but `app/build.gradle` signs release
  with the _debug_ keystore. Fine for testing on your own devices, never for
  distribution — see [code signing](../deployment/code-signing.md).

## Regenerating the native project

From `apps/mobile`:

```powershell
npx expo prebuild --platform android           # bring android/ up to date
npx expo prebuild --platform android --clean   # delete it and start over
```

Do this after editing `app.json`, after adding a dependency with native code,
and whenever the build has gone strange in a way you cannot explain. `--clean`
discards every local edit under `android/` — which is exactly why it works.

Nothing is lost from git either way; the folder is not tracked.

## Troubleshooting

| Symptom                                                | Cause                                       | Fix                                                                     |
| ------------------------------------------------------ | ------------------------------------------- | ----------------------------------------------------------------------- |
| `SDK location not found`                               | `ANDROID_HOME` unset, no `local.properties` | Set it, [above](#set-android_home)                                      |
| `Cannot run program "node"` during Gradle sync         | Studio's PATH has no Node                   | Restart Studio, or launch it from a terminal where `node` works         |
| `Could not resolve react-native` / Expo plugin missing | `pnpm install` never ran                    | `pnpm install` at the repository root                                   |
| `Failed to find target with hash string android-NN`    | That SDK platform is not installed          | SDK Manager → tick that API level                                       |
| Licence not accepted                                   | Missing SDK licences                        | `sdkmanager --licenses` (needs the command-line tools)                  |
| `Unable to load script` / red connection screen        | Metro not running or unreachable            | `pnpm dev:mobile`, then `adb reverse tcp:8081 tcp:8081`                 |
| Installs, then a white screen                          | Metro is still bundling                     | Watch the Metro terminal; it resolves on its own                        |
| `adb devices` shows `unauthorized`                     | RSA prompt not accepted                     | Unplug, replug, accept. Or `adb kill-server` then `adb start-server`    |
| `Unsupported class file major version`                 | Gradle running on the wrong JDK             | Settings → Build Tools → Gradle → **Gradle JDK** → the bundled `jbr-21` |
| Gradle daemon runs out of memory                       | 2 GB heap in `gradle.properties`            | Raise to `org.gradle.jvmargs=-Xmx4096m` (reset by the next prebuild)    |
| Edits in `packages/*` have no effect                   | Metro cached the old module                 | Restart Metro with `npx expo start --clear`                             |

## Where mobile fits

CI builds the web and desktop applications; mobile builds are optional in the
release pipeline and nothing is published to a store yet. Everything here is
development-only. See [getting started](getting-started.md) and
[continuous integration](continuous-integration.md).
