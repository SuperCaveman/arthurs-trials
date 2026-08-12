// Dedicated-server build target for local testing and later GameLift hosting.
// This creates a server-only executable separate from the client/game build.

using UnrealBuildTool;

public class ArthursTrialsServerTarget : TargetRules
{
	public ArthursTrialsServerTarget(TargetInfo Target) : base(Target)
	{
		Type = TargetType.Server;
		DefaultBuildSettings = BuildSettingsVersion.V7;
		IncludeOrderVersion = EngineIncludeOrderVersion.Unreal5_8;

		// This local GameLift proof does not need a linker PDB. On a 32 GB
		// workstation, generating one for a monolithic Development server can
		// push the linker past the available memory and destabilize the machine.
		bOmitPCDebugInfoInDevelopment = true;
		bUsePDBFiles = false;
		bUseIncrementalLinking = false;
		bCreateMapFile = false;
		WindowsPlatform.bNoLinkerDebugInfo = true;

		ExtraModuleNames.Add("ArthursTrials");
	}
}
