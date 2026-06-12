# TestFlight Version Investigation

Status: submitted.

Observed from source/config:
- `apps/mobile/eas.json` uses `cli.appVersionSource = remote`.
- The production profile uses `autoIncrement = true`.
- `apps/mobile/app.json` previously had Expo marketing version `1.0.0`.
- `apps/mobile/app.json` had `ios.buildNumber = 1`, but EAS reports this field is ignored when version source is remote and may still appear in the manifest.

Observed from EAS:
- Remote iOS build number before the new build was `20`.
- Latest finished iOS build before this audit was version `1.0.0`, build `20`, commit `968fd887...`.
- GitHub `main` at audit start was `ad1937ec...`, newer than the latest EAS iOS build.

Action taken:
- Bumped Expo marketing version from `1.0.0` to `1.0.2`.
- Started EAS iOS production build `99762e3e-8d7c-4d1a-bc66-2cb59235205d`.
- EAS incremented remote iOS build number from `20` to `21`.
- Build metadata: version `1.0.2`, build `21`, commit `ad1937ec...`.
- Auto-submit scheduling failed because `--what-to-test` maps to EAS Submit changelog and the current plan does not allow changelog submission. Submit should be retried without `--what-to-test` after build completion.
- Build completed successfully and produced IPA URL under EAS build `99762e3e-8d7c-4d1a-bc66-2cb59235205d`.
- Manual EAS submit without changelog succeeded.
- Submission ID: `5531132f-e109-45ac-9c55-b04c57048993`.
- Apple status after submit: binary uploaded to App Store Connect and processing by Apple.
- TestFlight URL: https://appstoreconnect.apple.com/apps/6771878736/testflight/ios
- Later EAS build list confirmation: build `99762e3e-8d7c-4d1a-bc66-2cb59235205d` is finished as version `1.0.2`, build number `21`.
