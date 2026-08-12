// Copyright Epic Games, Inc. All Rights Reserved.

#include "ArthursTrialsGameMode.h"

#include "Engine/NetConnection.h"
#include "GameFramework/PlayerController.h"
#include "Kismet/GameplayStatics.h"
#include "Misc/CommandLine.h"
#include "Misc/Parse.h"
#include "Misc/Paths.h"

#if WITH_GAMELIFT
#include "GameLiftServerSDK.h"
#include "GameLiftServerSDKModels.h"
#endif

DEFINE_LOG_CATEGORY(LogArthursTrialsGameServer);

AArthursTrialsGameMode::AArthursTrialsGameMode()
{
	// stub
}

void AArthursTrialsGameMode::BeginPlay()
{
	Super::BeginPlay();

#if WITH_GAMELIFT
	if (GetNetMode() != NM_DedicatedServer)
	{
		return;
	}

	// Local dedicated-server testing stays fully offline unless this explicit
	// flag is supplied by a GameLift managed or Anywhere launch configuration.
	if (!FParse::Param(FCommandLine::Get(), TEXT("GameLiftEnabled")))
	{
		UE_LOG(LogArthursTrialsGameServer, Log,
			TEXT("GameLift lifecycle is installed but disabled for this local server. Use -GameLiftEnabled on a managed or Anywhere launch."));
		return;
	}

	InitGameLift();
#endif
}

void AArthursTrialsGameMode::PreLogin(const FString& Options, const FString& Address, const FUniqueNetIdRepl& UniqueId, FString& ErrorMessage)
{
	Super::PreLogin(Options, Address, UniqueId, ErrorMessage);

#if WITH_GAMELIFT
	if (!ErrorMessage.IsEmpty() || !bGameLiftPlayerSessionValidationRequired)
	{
		return;
	}

	if (!bGameLiftGameSessionActive || GameLiftSdkModule == nullptr)
	{
		ErrorMessage = TEXT("GameLift game session is not ready for players.");
		UE_LOG(LogArthursTrialsGameServer, Warning, TEXT("Rejected %s because no active GameLift game session is available."), *Address);
		return;
	}

	const FString PlayerSessionId = UGameplayStatics::ParseOption(Options, TEXT("PlayerSessionId"));
	if (PlayerSessionId.IsEmpty())
	{
		ErrorMessage = TEXT("A GameLift PlayerSessionId is required.");
		UE_LOG(LogArthursTrialsGameServer, Warning, TEXT("Rejected %s because it did not provide a PlayerSessionId."), *Address);
		return;
	}

	const FGameLiftGenericOutcome AcceptOutcome = GameLiftSdkModule->AcceptPlayerSession(PlayerSessionId);
	if (!AcceptOutcome.IsSuccess())
	{
		ErrorMessage = TEXT("GameLift rejected the player session.");
		UE_LOG(LogArthursTrialsGameServer, Warning, TEXT("Rejected %s because GameLift did not accept its player session: %s"),
			*Address, *AcceptOutcome.GetError().m_errorMessage);
		return;
	}

	PendingPlayerSessionsByAddress.Add(Address, PlayerSessionId);
	UE_LOG(LogArthursTrialsGameServer, Log, TEXT("GameLift accepted a player session for %s."), *Address);
#endif
}

void AArthursTrialsGameMode::PostLogin(APlayerController* NewPlayer)
{
	Super::PostLogin(NewPlayer);

#if WITH_GAMELIFT
	if (!bGameLiftPlayerSessionValidationRequired || NewPlayer == nullptr || NewPlayer->GetNetConnection() == nullptr)
	{
		return;
	}

	const FString Address = NewPlayer->GetNetConnection()->LowLevelGetRemoteAddress();
	if (FString* PlayerSessionId = PendingPlayerSessionsByAddress.Find(Address))
	{
		AcceptedPlayerSessions.Add(NewPlayer, *PlayerSessionId);
		PendingPlayerSessionsByAddress.Remove(Address);
		UE_LOG(LogArthursTrialsGameServer, Log, TEXT("Bound validated GameLift player session to %s."), *Address);
	}
#endif
}

void AArthursTrialsGameMode::Logout(AController* Exiting)
{
#if WITH_GAMELIFT
	if (bGameLiftPlayerSessionValidationRequired && GameLiftSdkModule != nullptr && Exiting != nullptr)
	{
		if (FString* PlayerSessionId = AcceptedPlayerSessions.Find(Exiting))
		{
			const FGameLiftGenericOutcome RemoveOutcome = GameLiftSdkModule->RemovePlayerSession(*PlayerSessionId);
			if (RemoveOutcome.IsSuccess())
			{
				UE_LOG(LogArthursTrialsGameServer, Log, TEXT("Released GameLift player session during logout."));
			}
			else
			{
				UE_LOG(LogArthursTrialsGameServer, Warning, TEXT("Unable to release GameLift player session during logout: %s"),
					*RemoveOutcome.GetError().m_errorMessage);
			}
			AcceptedPlayerSessions.Remove(Exiting);
		}
	}
#endif

	Super::Logout(Exiting);
}

int32 AArthursTrialsGameMode::GetGameLiftPort() const
{
	int32 Port = 7777;
	FParse::Value(FCommandLine::Get(), TEXT("Port="), Port);
	return Port;
}

void AArthursTrialsGameMode::InitGameLift()
{
#if WITH_GAMELIFT
	GameLiftSdkModule =
		&FModuleManager::LoadModuleChecked<FGameLiftServerSDKModule>(TEXT("GameLiftServerSDK"));

	const bool bAnywhereMode = FParse::Param(FCommandLine::Get(), TEXT("glAnywhere"));
	FGameLiftGenericOutcome InitOutcome;
	if (bAnywhereMode)
	{
		FServerParameters AnywhereParameters;
		FParse::Value(FCommandLine::Get(), TEXT("glAnywhereWebSocketUrl="), AnywhereParameters.m_webSocketUrl);
		FParse::Value(FCommandLine::Get(), TEXT("glAnywhereFleetId="), AnywhereParameters.m_fleetId);
		FParse::Value(FCommandLine::Get(), TEXT("glAnywhereProcessId="), AnywhereParameters.m_processId);
		FParse::Value(FCommandLine::Get(), TEXT("glAnywhereHostId="), AnywhereParameters.m_hostId);
		FParse::Value(FCommandLine::Get(), TEXT("glAnywhereAuthToken="), AnywhereParameters.m_authToken);
		FParse::Value(FCommandLine::Get(), TEXT("glAnywhereAwsRegion="), AnywhereParameters.m_awsRegion);
		FParse::Value(FCommandLine::Get(), TEXT("glAnywhereAccessKey="), AnywhereParameters.m_accessKey);
		FParse::Value(FCommandLine::Get(), TEXT("glAnywhereSecretKey="), AnywhereParameters.m_secretKey);
		FParse::Value(FCommandLine::Get(), TEXT("glAnywhereSessionToken="), AnywhereParameters.m_sessionToken);

		UE_LOG(LogArthursTrialsGameServer, Log, TEXT("Initializing GameLift for an Anywhere compute."));
		InitOutcome = GameLiftSdkModule->InitSDK(AnywhereParameters);
	}
	else
	{
		UE_LOG(LogArthursTrialsGameServer, Log, TEXT("Initializing GameLift for a managed hosting environment."));
		InitOutcome = GameLiftSdkModule->InitSDK();
	}

	if (!InitOutcome.IsSuccess())
	{
		UE_LOG(LogArthursTrialsGameServer, Error, TEXT("GameLift InitSDK failed: %s"), *InitOutcome.GetError().m_errorMessage);
		return;
	}

	bGameLiftPlayerSessionValidationRequired = FParse::Param(FCommandLine::Get(), TEXT("GameLiftRequirePlayerSession"));
	if (bGameLiftPlayerSessionValidationRequired)
	{
		UE_LOG(LogArthursTrialsGameServer, Log, TEXT("GameLift player-session validation is required for client connections."));
	}

	FParse::Value(FCommandLine::Get(), TEXT("GameLiftFailHealthChecks="), RemainingForcedHealthCheckFailures);
	RemainingForcedHealthCheckFailures = FMath::Max(0, RemainingForcedHealthCheckFailures);
	if (RemainingForcedHealthCheckFailures > 0)
	{
		UE_LOG(LogArthursTrialsGameServer, Warning,
			TEXT("Fault-injection mode enabled: the next %d GameLift health check(s) will fail, then health checks will recover."),
			RemainingForcedHealthCheckFailures);
	}

	GameLiftProcessParameters = MakeShared<FProcessParameters>();
	GameLiftProcessParameters->port = GetGameLiftPort();
	GameLiftProcessParameters->logParameters.Add(FPaths::ProjectLogDir());
	GameLiftProcessParameters->OnStartGameSession.BindLambda([this](Aws::GameLift::Server::Model::GameSession InGameSession)
	{
		UE_LOG(LogArthursTrialsGameServer, Log, TEXT("GameLift requested session activation: %s"), *FString(InGameSession.GetGameSessionId()));
		bGameLiftGameSessionActive = true;
		GameLiftSdkModule->ActivateGameSession();
	});
	GameLiftProcessParameters->OnHealthCheck.BindLambda([this]()
	{
		if (RemainingForcedHealthCheckFailures > 0)
		{
			--RemainingForcedHealthCheckFailures;
			UE_LOG(LogArthursTrialsGameServer, Warning,
				TEXT("Fault injection: deliberately failed a GameLift health check. %d forced failure(s) remain."),
				RemainingForcedHealthCheckFailures);
			return false;
		}

		UE_LOG(LogArthursTrialsGameServer, Verbose, TEXT("GameLift health check passed."));
		return true;
	});
	GameLiftProcessParameters->OnTerminate.BindLambda([this]()
	{
		UE_LOG(LogArthursTrialsGameServer, Warning, TEXT("GameLift requested process termination."));
		bGameLiftGameSessionActive = false;
		const FGameLiftGenericOutcome ProcessEndingOutcome = GameLiftSdkModule->ProcessEnding();
		const FGameLiftGenericOutcome DestroyOutcome = GameLiftSdkModule->Destroy();
		if (!ProcessEndingOutcome.IsSuccess() || !DestroyOutcome.IsSuccess())
		{
			UE_LOG(LogArthursTrialsGameServer, Error, TEXT("GameLift shutdown callbacks returned an error."));
		}
		FPlatformMisc::RequestExit(false);
	});

	const FGameLiftGenericOutcome ProcessReadyOutcome = GameLiftSdkModule->ProcessReady(*GameLiftProcessParameters);
	if (ProcessReadyOutcome.IsSuccess())
	{
		UE_LOG(LogArthursTrialsGameServer, Log, TEXT("GameLift ProcessReady succeeded on port %d."), GameLiftProcessParameters->port);
	}
	else
	{
		UE_LOG(LogArthursTrialsGameServer, Error, TEXT("GameLift ProcessReady failed: %s"), *ProcessReadyOutcome.GetError().m_errorMessage);
	}
#endif
}
