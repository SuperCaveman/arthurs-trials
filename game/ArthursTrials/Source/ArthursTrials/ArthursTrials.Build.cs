// Copyright Epic Games, Inc. All Rights Reserved.

using UnrealBuildTool;

public class ArthursTrials : ModuleRules
{
	public ArthursTrials(ReadOnlyTargetRules Target) : base(Target)
	{
		PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;

		PublicDependencyModuleNames.AddRange(new string[] {
			"Core",
			"CoreUObject",
			"Engine",
			"InputCore",
			"EnhancedInput",
			"Json",
			"JsonUtilities",
			"AIModule",
			"StateTreeModule",
			"GameplayStateTreeModule",
			"UMG",
			"Slate"
		});

		PrivateDependencyModuleNames.AddRange(new string[] { });

		// The GameLift server SDK must never be linked into client or editor builds.
		// This keeps regular local gameplay independent of AWS while making the
		// dedicated-server target ready for GameLift lifecycle management.
		if (Target.Type == TargetType.Server)
		{
			PublicDependencyModuleNames.Add("GameLiftServerSDK");
		}
		else
		{
			PublicDefinitions.Add("WITH_GAMELIFT=0");
		}

		bEnableExceptions = true;

		PublicIncludePaths.AddRange(new string[] {
			"ArthursTrials",
			"ArthursTrials/Variant_Platforming",
			"ArthursTrials/Variant_Platforming/Animation",
			"ArthursTrials/Variant_Combat",
			"ArthursTrials/Variant_Combat/AI",
			"ArthursTrials/Variant_Combat/Animation",
			"ArthursTrials/Variant_Combat/Gameplay",
			"ArthursTrials/Variant_Combat/Interfaces",
			"ArthursTrials/Variant_Combat/UI",
			"ArthursTrials/Variant_SideScrolling",
			"ArthursTrials/Variant_SideScrolling/AI",
			"ArthursTrials/Variant_SideScrolling/Gameplay",
			"ArthursTrials/Variant_SideScrolling/Interfaces",
			"ArthursTrials/Variant_SideScrolling/UI"
		});

		// Uncomment if you are using Slate UI
		// PrivateDependencyModuleNames.AddRange(new string[] { "Slate", "SlateCore" });

		// Uncomment if you are using online features
		// PrivateDependencyModuleNames.Add("OnlineSubsystem");

		// To include OnlineSubsystemSteam, add it to the plugins section in your uproject file with the Enabled attribute set to true
	}
}
