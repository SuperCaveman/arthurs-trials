// Copyright Epic Games, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "GameFramework/GameModeBase.h"
#include "ArthursTrialsGameMode.generated.h"

struct FProcessParameters;
class FGameLiftServerSDKModule;
class AController;
class APlayerController;

DECLARE_LOG_CATEGORY_EXTERN(LogArthursTrialsGameServer, Log, All);

/**
 *  Simple GameMode for a third person game
 */
UCLASS(abstract)
class AArthursTrialsGameMode : public AGameModeBase
{
	GENERATED_BODY()

public:
	
	/** Constructor */
	AArthursTrialsGameMode();

protected:
	virtual void BeginPlay() override;
	virtual void PreLogin(const FString& Options, const FString& Address, const FUniqueNetIdRepl& UniqueId, FString& ErrorMessage) override;
	virtual void PostLogin(APlayerController* NewPlayer) override;
	virtual void Logout(AController* Exiting) override;

private:
	void InitGameLift();
	int32 GetGameLiftPort() const;

	TSharedPtr<FProcessParameters> GameLiftProcessParameters;
	FGameLiftServerSDKModule* GameLiftSdkModule = nullptr;
	bool bGameLiftPlayerSessionValidationRequired = false;
	bool bGameLiftGameSessionActive = false;
	int32 RemainingForcedHealthCheckFailures = 0;
	TMap<FString, FString> PendingPlayerSessionsByAddress;
	TMap<TWeakObjectPtr<AController>, FString> AcceptedPlayerSessions;
};



