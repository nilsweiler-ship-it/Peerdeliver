const { withXcodeProject } = require('@expo/config-plugins');

/**
 * Disable Xcode's user script sandboxing for the app target.
 *
 * Xcode 26 defaults ENABLE_USER_SCRIPT_SANDBOXING to YES. React Native's
 * `react-native-xcode.sh` writes an `ip.txt` into the built .app bundle so a
 * device build knows which Mac to reach for the dev bundler. The sandbox denies
 * that write and the build fails with:
 *
 *   react-native-xcode.sh: line 27: .../Shlep.app/ip.txt: Operation not permitted
 *   Command PhaseScriptExecution failed with a nonzero exit code
 *
 * The error names a file rather than the sandbox, which makes it easy to
 * misdiagnose as a permissions or CocoaPods problem.
 *
 * This is a config plugin rather than a manual Xcode setting because
 * `expo prebuild --clean` regenerates the project and would silently discard
 * the change — leaving the same failure to be rediscovered later.
 */
module.exports = function withScriptSandboxDisabled(config) {
  return withXcodeProject(config, (cfg) => {
    const project = cfg.modResults;
    const configurations = project.pbxXCBuildConfigurationSection();

    for (const key of Object.keys(configurations)) {
      const buildSettings = configurations[key]?.buildSettings;
      if (!buildSettings) continue;
      if ('ENABLE_USER_SCRIPT_SANDBOXING' in buildSettings) {
        buildSettings.ENABLE_USER_SCRIPT_SANDBOXING = 'NO';
      }
    }
    return cfg;
  });
};
