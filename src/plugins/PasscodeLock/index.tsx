/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { showNotification } from "@api/Notifications";
import { definePluginSettings } from "@api/Settings";
import { Modals, openModal } from "@utils/modal";
import definePlugin, { OptionType } from "@utils/types";
import { Button, Forms, React, TextInput } from "@webpack/common";

const settings = definePluginSettings({
    passcode: {
        type: OptionType.STRING,
        description: "Set your passcode for locking Discord",
        default: "",
    },
    lockOnStartup: {
        type: OptionType.BOOLEAN,
        description: "Lock Discord on startup",
        default: true,
    },
    timeout: {
        type: OptionType.NUMBER,
        description: "Timeout for auto-lock (in seconds)",
        default: 300,
    },
    maxAttempts: {
        type: OptionType.NUMBER,
        description: "Maximum passcode entry attempts before temporary lockout",
        default: 5,
    },
    lockDuration: {
        type: OptionType.NUMBER,
        description: "Lockout duration after max attempts (in seconds)",
        default: 300,
    },
});

let attemptCount = 0;
let lockTime = 0;
let isModalOpen = false;

const validatePasscodeStrength = passcode => {
    return passcode.length >= 4;
};

const lockDiscord = () => {
    showNotification({
        title: "Passcode Lock",
        body: "Discord has been locked.",
        color: "var(--red-360)",
    });
};

const unlockDiscord = (enteredPasscode, setError) => {
    if (lockTime && Date.now() < lockTime) {
        const timeRemaining = Math.ceil((lockTime - Date.now()) / 1000);
        setError(`You are locked out for another ${timeRemaining} seconds.`);
        return false;
    }

    if (enteredPasscode === settings.store.passcode) {
        attemptCount = 0;
        setError("");
        isModalOpen = false;
        showNotification({
            title: "Passcode Lock",
            body: "Discord has been unlocked.",
            color: "var(--green-360)",
        });
        return true;
    } else {
        attemptCount++;
        if (attemptCount >= settings.store.maxAttempts) {
            lockTime = Date.now() + settings.store.lockDuration * 1000;
            setError(`Maximum attempts reached. You are locked out for ${settings.store.lockDuration} seconds.`);
        } else {
            setError(`Incorrect passcode. ${settings.store.maxAttempts - attemptCount} attempts remaining.`);
        }
        return false;
    }
};

const adjustBackdropBlur = (blur: boolean) => {
    const backdrop = document.querySelector("[class^='backdrop_'][class*='withLayer_']") as HTMLElement | null;
    if (backdrop) {
        backdrop.style.backdropFilter = blur ? "blur(10px)" : "none";
        backdrop.style.transition = "backdrop-filter 0.3s ease";
    }
};

const RegisterPasscodeModal = props => {
    const [error, setError] = React.useState("");
    const [newPasscode, setNewPasscode] = React.useState("");
    const [confirmPasscode, setConfirmPasscode] = React.useState("");

    return (
        <Modals.ModalRoot {...props} className="register-passcode-modal">
            <Modals.ModalHeader>
                <Forms.FormTitle tag="h3">Register a Passcode</Forms.FormTitle>
            </Modals.ModalHeader>
            <Modals.ModalContent>
                <TextInput
                    type="password"
                    placeholder="Enter a new passcode"
                    value={newPasscode}
                    onChange={value => setNewPasscode(value)}
                    style={{ marginTop: "10px", padding: "8px" }}
                    autoFocus
                />
                <TextInput
                    type="password"
                    placeholder="Confirm your passcode"
                    value={confirmPasscode}
                    onChange={value => setConfirmPasscode(value)}
                    style={{ marginTop: "10px", marginBottom: "10px", padding: "8px" }}
                />
                {error && <Forms.FormText type="danger">{error}</Forms.FormText>}
            </Modals.ModalContent>
            <Modals.ModalFooter>
                <Button
                    onClick={() => {
                        if (newPasscode && newPasscode === confirmPasscode) {
                            if (!validatePasscodeStrength(newPasscode)) {
                                setError("Passcode must be at least 4 characters long.");
                            } else {
                                settings.store.passcode = newPasscode;
                                props.onClose();
                                showNotification({
                                    title: "Passcode Lock",
                                    body: "Passcode has been set successfully.",
                                    color: "var(--green-360)",
                                });
                            }
                        } else {
                            setError("Passcodes do not match. Please try again.");
                        }
                    }}
                >
                    Set Passcode
                </Button>
            </Modals.ModalFooter>
        </Modals.ModalRoot>
    );
};

const LoginPasscodeModal = props => {
    const [error, setError] = React.useState("");
    const [enteredPasscode, setEnteredPasscode] = React.useState("");

    return (
        <Modals.ModalRoot {...props}>
            <Modals.ModalHeader>
                <Forms.FormTitle tag="h3">Enter Passcode</Forms.FormTitle>
            </Modals.ModalHeader>
            <Modals.ModalContent>
                <TextInput
                    type="password"
                    placeholder="Enter your passcode"
                    value={enteredPasscode}
                    onChange={value => setEnteredPasscode(value)}
                    onKeyDown={e => {
                        if (e.key === "Enter") {
                            if (unlockDiscord(enteredPasscode, setError)) {
                                props.onClose();
                            }
                        }
                    }}
                    style={{ marginTop: "10px", padding: "8px" }}
                    autoFocus
                />
                {error && <Forms.FormText type="danger">{error}</Forms.FormText>}
            </Modals.ModalContent>
            <Modals.ModalFooter>
                <Button
                    onClick={() => {
                        if (unlockDiscord(enteredPasscode, setError)) {
                            props.onClose();
                        }
                    }}
                >
                    Unlock
                </Button>
            </Modals.ModalFooter>
        </Modals.ModalRoot>
    );
};

const handleKeyDown = e => {
    if (e.ctrlKey && e.key === "l") {
        lockDiscord();
        if (!isModalOpen) {
            isModalOpen = true;
            openModal(
                props => (
                    <LoginPasscodeModal
                        {...props}
                        onClose={() => {
                            adjustBackdropBlur(false);
                            isModalOpen = false;
                            props.onClose();
                        }}
                    />
                ),
                { onCloseRequest: () => {} }
            );
            setTimeout(() => adjustBackdropBlur(true), 100);
        }
    }
};

document.addEventListener("keydown", handleKeyDown);

export default definePlugin({
    name: "PasscodeLock",
    description: "Locks your Discord with a passcode.",
    authors: [
        { name: "GuikiPT", id: BigInt("926914230924509264") },
    ],
    start() {
        if (!settings.store.passcode) {
            openModal(
                props => <RegisterPasscodeModal {...props} />,
                { onCloseRequest: () => {} }
            );
            setTimeout(() => adjustBackdropBlur(true), 100);
            return;
        }

        if (settings.store.lockOnStartup) {
            lockDiscord();
            if (!isModalOpen) {
                isModalOpen = true;
                setTimeout(() => {
                    openModal(
                        props => (
                            <LoginPasscodeModal
                                {...props}
                                onClose={() => {
                                    adjustBackdropBlur(false);
                                    isModalOpen = false;
                                    props.onClose();
                                }}
                            />
                        ),
                        { onCloseRequest: () => {} }
                    );
                    setTimeout(() => adjustBackdropBlur(true), 100);
                }, 100);
            }
        }

        setTimeout(() => {
            lockDiscord();
            if (!isModalOpen) {
                isModalOpen = true;
                openModal(
                    props => (
                        <LoginPasscodeModal
                            {...props}
                            onClose={() => {
                                adjustBackdropBlur(false);
                                isModalOpen = false;
                                props.onClose();
                            }}
                        />
                    ),
                    { onCloseRequest: () => {} }
                );
                setTimeout(() => adjustBackdropBlur(true), 100);
            }
        }, settings.store.timeout * 1000);
    },
    stop() {
        document.removeEventListener("keydown", handleKeyDown);
    },
    settings,
});
