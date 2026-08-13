// Copyright Epic Games, Inc. All Rights Reserved.

#include "ArthursTrialsGameMode.h"

#include "Async/Async.h"
#include "Dom/JsonObject.h"
#include "Engine/NetConnection.h"
#include "GameFramework/PlayerController.h"
#include "HAL/FileManager.h"
#include "Kismet/GameplayStatics.h"
#include "Misc/CommandLine.h"
#include "Misc/DateTime.h"
#include "Misc/FileHelper.h"
#include "Misc/Guid.h"
#include "Misc/Parse.h"
#include "Misc/Paths.h"
#include "Serialization/JsonSerializer.h"
#include "Serialization/JsonWriter.h"

#if WITH_GAMELIFT
#include "GameLiftServerSDK.h"
#include "GameLiftServerSDKModels.h"
#endif

DEFINE_LOG_CATEGORY(LogArthursTrialsGameServer);

namespace
{
	bool IsValidResultsPlayerId(const FString& PlayerId)
	{
		if (PlayerId.Len() < 3 || PlayerId.Len() > 64)
		{
			return false;
		}

		for (const TCHAR Character : PlayerId)
		{
			if (!(FChar::IsAlnum(Character) || Character == TEXT('.') || Character == TEXT('_') || Character == TEXT('-')))
			{
				return false;
			}
		}

		return true;
	}
}

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

void AArthursTrialsGameMode::ConfigureMatchResults(const TMap<FString, FString>& GameProperties)
{
	ActiveMatchRequestId.Reset();
	ActiveMatchParticipants.Reset();
	bMatchResultsEmitted = false;

	const FString* MatchId = GameProperties.Find(TEXT("matchId"));
	const FString* Participants = GameProperties.Find(TEXT("participants"));
	if (MatchId == nullptr || Participants == nullptr || !MatchId->StartsWith(TEXT("mrq_")))
	{
		UE_LOG(LogArthursTrialsGameServer, Log, TEXT("No match-results event is configured for this session."));
		return;
	}

	Participants->ParseIntoArray(ActiveMatchParticipants, TEXT(","), true);
	TSet<FString> UniqueParticipants;
	bool bParticipantsAreValid = true;
	for (const FString& PlayerId : ActiveMatchParticipants)
	{
		UniqueParticipants.Add(PlayerId);
		bParticipantsAreValid &= IsValidResultsPlayerId(PlayerId);
	}
	if (ActiveMatchParticipants.Num() < 1 || ActiveMatchParticipants.Num() > 4 ||
		!bParticipantsAreValid ||
		UniqueParticipants.Num() != ActiveMatchParticipants.Num())
	{
		UE_LOG(LogArthursTrialsGameServer, Error,
			TEXT("GameLift game-session properties contain invalid match-results participants; no result event will be emitted."));
		ActiveMatchParticipants.Reset();
		return;
	}

	ActiveMatchRequestId = *MatchId;
	if (const FString* XpAward = GameProperties.Find(TEXT("xpAward")))
	{
		MatchResultsXpAward = FMath::Clamp(FCString::Atoi(**XpAward), 0, 10000);
	}

	FParse::Value(FCommandLine::Get(), TEXT("MatchResultsCompleteAfterSeconds="), MatchResultsCompletionDelaySeconds);
	FParse::Value(FCommandLine::Get(), TEXT("MatchResultsOutboxDir="), MatchResultsOutboxDirectory);
	MatchResultsCompletionDelaySeconds = FMath::Clamp(MatchResultsCompletionDelaySeconds, 0, 3600);
	if (MatchResultsOutboxDirectory.IsEmpty())
	{
		MatchResultsOutboxDirectory = FPaths::Combine(FPaths::ProjectSavedDir(), TEXT("MatchResultsOutbox"));
	}

	if (MatchResultsCompletionDelaySeconds > 0)
	{
		GetWorldTimerManager().SetTimer(MatchResultsCompletionTimer, this,
			&AArthursTrialsGameMode::EmitAuthoritativeMatchCompletion,
			MatchResultsCompletionDelaySeconds, false);
		UE_LOG(LogArthursTrialsGameServer, Log,
			TEXT("Authoritative match-completion event is scheduled after %d second(s)."),
			MatchResultsCompletionDelaySeconds);
	}
	else
	{
		UE_LOG(LogArthursTrialsGameServer, Log,
			TEXT("Match-results metadata received; automatic completion is disabled until -MatchResultsCompleteAfterSeconds is supplied."));
	}
}

void AArthursTrialsGameMode::EmitAuthoritativeMatchCompletion()
{
	if (bMatchResultsEmitted || !bGameLiftGameSessionActive || ActiveMatchRequestId.IsEmpty() || ActiveMatchParticipants.IsEmpty())
	{
		return;
	}

	const FString EventId = FGuid::NewGuid().ToString(EGuidFormats::DigitsWithHyphens);
	const TSharedRef<FJsonObject> Event = MakeShared<FJsonObject>();
	Event->SetStringField(TEXT("eventType"), TEXT("match.completed"));
	Event->SetStringField(TEXT("eventId"), EventId);
	Event->SetStringField(TEXT("matchId"), ActiveMatchRequestId);
	Event->SetNumberField(TEXT("xpAward"), MatchResultsXpAward);
	Event->SetStringField(TEXT("completedAt"), FDateTime::UtcNow().ToIso8601());

	TArray<TSharedPtr<FJsonValue>> Participants;
	for (const FString& PlayerId : ActiveMatchParticipants)
	{
		Participants.Add(MakeShared<FJsonValueString>(PlayerId));
	}
	Event->SetArrayField(TEXT("participants"), Participants);

	FString Payload;
	const TSharedRef<TJsonWriter<>> Writer = TJsonWriterFactory<>::Create(&Payload);
	if (!FJsonSerializer::Serialize(Event, Writer))
	{
		UE_LOG(LogArthursTrialsGameServer, Error, TEXT("Unable to serialize the authoritative match-completion event."));
		return;
	}

	IFileManager::Get().MakeDirectory(*MatchResultsOutboxDirectory, true);
	const FString FinalPath = FPaths::Combine(MatchResultsOutboxDirectory, EventId + TEXT(".json"));
	const FString TemporaryPath = FinalPath + TEXT(".tmp");
	if (!FFileHelper::SaveStringToFile(Payload, *TemporaryPath, FFileHelper::EEncodingOptions::ForceUTF8WithoutBOM) ||
		!IFileManager::Get().Move(*FinalPath, *TemporaryPath, true, true))
	{
		UE_LOG(LogArthursTrialsGameServer, Error, TEXT("Unable to publish the authoritative match-completion event to the local outbox."));
		return;
	}

	bMatchResultsEmitted = true;
	UE_LOG(LogArthursTrialsGameServer, Log,
		TEXT("Authoritative match-completion event published to the local outbox for %d participant(s)."),
		ActiveMatchParticipants.Num());
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
			TEXT("Fault-injection mode enabled: the next %d GameLift health check(s) will fail; GameLift should terminate this process and a replacement should recover."),
			RemainingForcedHealthCheckFailures);
	}

	GameLiftProcessParameters = MakeShared<FProcessParameters>();
	GameLiftProcessParameters->port = GetGameLiftPort();
	GameLiftProcessParameters->logParameters.Add(FPaths::ProjectLogDir());
	GameLiftProcessParameters->OnStartGameSession.BindLambda([this](Aws::GameLift::Server::Model::GameSession InGameSession)
	{
		UE_LOG(LogArthursTrialsGameServer, Log, TEXT("GameLift requested session activation: %s"), *FString(InGameSession.GetGameSessionId()));
		TMap<FString, FString> GameProperties;
		int GamePropertyCount = 0;
		const Aws::GameLift::Server::Model::GameProperty* SessionProperties = InGameSession.GetGameProperties(GamePropertyCount);
		for (int PropertyIndex = 0; SessionProperties != nullptr && PropertyIndex < GamePropertyCount; ++PropertyIndex)
		{
			const Aws::GameLift::Server::Model::GameProperty& Property = SessionProperties[PropertyIndex];
			GameProperties.Add(FString(Property.GetKey()), FString(Property.GetValue()));
		}
		GameLiftSdkModule->ActivateGameSession();

		// The GameLift SDK invokes this callback from one of its networking
		// threads. Unreal session state and timers must be configured on the
		// game thread before a match can emit an authoritative result event.
		AsyncTask(ENamedThreads::GameThread, [this, GameProperties = MoveTemp(GameProperties)]() mutable
		{
			bGameLiftGameSessionActive = true;
			ConfigureMatchResults(GameProperties);
		});
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
