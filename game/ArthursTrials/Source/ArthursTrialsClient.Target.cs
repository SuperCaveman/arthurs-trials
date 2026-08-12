// Client-only target used for portable builds that connect to Arthur's Trials servers.
using UnrealBuildTool;

public class ArthursTrialsClientTarget : TargetRules
{
	public ArthursTrialsClientTarget(TargetInfo Target) : base(Target)
	{
		Type = TargetType.Client;
		DefaultBuildSettings = BuildSettingsVersion.V7;
		IncludeOrderVersion = EngineIncludeOrderVersion.Unreal5_8;
		ExtraModuleNames.Add("ArthursTrials");
	}
}
