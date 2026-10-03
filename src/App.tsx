
import { useEffect, useState, type CSSProperties } from "react";
import {
  signUp,
  confirmSignUp,
  signIn,
  confirmSignIn,
  signOut,
  resetPassword,
  confirmResetPassword,
  getCurrentUser,
  fetchMFAPreference,
  setUpTOTP,
  verifyTOTPSetup,
  updateMFAPreference,
} from "aws-amplify/auth";
import { QRCodeSVG } from "qrcode.react";

type Screen =
  | "login"
  | "signup"
  | "verifyEmail"
  | "forgotPassword"
  | "resetPassword"
  | "mfaVerify"
  | "mfaSetup"
  | "home";

type MfaSetupMode = "account" | "signin";

type Activity = {
  id: number;
  event: string;
  time: string;
};

export default function App() {
  const [screen, setScreen] = useState<Screen>("login");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [mfaCode, setMfaCode] = useState("");

  const [userEmail, setUserEmail] = useState("");
  const [userId, setUserId] = useState("");

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [totpUri, setTotpUri] = useState("");
  const [mfaSetupMode, setMfaSetupMode] =
    useState<MfaSetupMode>("account");

  const [activities, setActivities] = useState<Activity[]>([]);

  const showMessage = (text: string) => {
    setMessage(text);
    setError("");
  };

  const showError = (err: unknown) => {
    const text =
      err instanceof Error
        ? err.message
        : "Something went wrong. Please try again.";

    setError(text);
    setMessage("");
  };

  const addActivity = (event: string) => {
    setActivities((previous) => [
      {
        id: Date.now() + Math.random(),
        event,
        time: new Date().toLocaleString(),
      },
      ...previous,
    ]);
  };

  const runAction = async (action: () => Promise<void>) => {
    setLoading(true);
    setError("");
    setMessage("");

    try {
      await action();
    } catch (err) {
      showError(err);
    } finally {
      setLoading(false);
    }
  };

  const checkMfaStatus = async () => {
    try {
      const preference = await fetchMFAPreference();

      const enabled =
        Array.isArray(preference.enabled) &&
        preference.enabled.includes("TOTP");

      const preferred = preference.preferred === "TOTP";

      setMfaEnabled(enabled || preferred);
    } catch (err) {
      console.error("Unable to check MFA preference:", err);
      setMfaEnabled(false);
    }
  };

  const loadCurrentUser = async () => {
    const user = await getCurrentUser();

    setUserEmail(user.username);
    setUserId(user.userId);
    setScreen("home");

    await checkMfaStatus();
  };

  // Restore an existing Cognito session when the app opens.
  useEffect(() => {
    let active = true;

    const checkExistingSession = async () => {
      try {
        const user = await getCurrentUser();

        if (!active) return;

        setUserEmail(user.username);
        setUserId(user.userId);
        setScreen("home");
      } catch {
        // No active session: keep the login screen visible.
      }
    };

    checkExistingSession();

    return () => {
      active = false;
    };
  }, []);

  // Load the MFA preference whenever the dashboard is displayed.
  useEffect(() => {
    if (screen === "home") {
      checkMfaStatus();
    }
  }, [screen]);

  const handleSignUp = () =>
    runAction(async () => {
      if (!email.trim() || !password) {
        throw new Error("Please enter your email and password.");
      }

      if (password !== confirmPassword) {
        throw new Error("Passwords do not match.");
      }

      const result = await signUp({
        username: email.trim(),
        password,
        options: {
          userAttributes: {
            email: email.trim(),
          },
        },
      });

      setUserEmail(email.trim());

      if (result.nextStep.signUpStep === "CONFIRM_SIGN_UP") {
        setScreen("verifyEmail");
        showMessage("Enter the verification code sent to your email.");
      } else {
        setScreen("login");
        showMessage("Your account has been created. Please sign in.");
      }
    });

  const handleConfirmSignUp = () =>
    runAction(async () => {
      await confirmSignUp({
        username: userEmail || email.trim(),
        confirmationCode: verificationCode.trim(),
      });

      setVerificationCode("");
      setScreen("login");
      showMessage("Email verified. You can now sign in.");
    });

  const handleSignIn = () =>
    runAction(async () => {
      if (!email.trim() || !password) {
        throw new Error("Please enter your email and password.");
      }

      const result = await signIn({
        username: email.trim(),
        password,
      });

      const nextStep = result.nextStep as any;
      const step = nextStep.signInStep;

      if (step === "DONE") {
        await loadCurrentUser();
        addActivity("Successful sign-in");
        showMessage("You are signed in successfully.");
      } else if (step === "CONFIRM_SIGN_IN_WITH_TOTP_CODE") {
        setUserEmail(email.trim());
        setScreen("mfaVerify");
        showMessage(
          "Enter the 6-digit code from your authenticator app."
        );
      } else if (step === "CONFIRM_SIGN_IN_WITH_SMS_CODE") {
        setUserEmail(email.trim());
        setScreen("mfaVerify");
        showMessage("Enter the verification code sent to your phone.");
      } else if (step === "CONFIRM_SIGN_IN_WITH_EMAIL_CODE") {
        setUserEmail(email.trim());
        setScreen("mfaVerify");
        showMessage("Enter the verification code sent to your email.");
      } else if (step === "CONTINUE_SIGN_IN_WITH_TOTP_SETUP") {
        const uri =
          nextStep.totpSetupDetails.getSetupUri("SecureSphereWeb");

        setTotpUri(uri.toString());
        setMfaSetupMode("signin");
        setMfaCode("");
        setUserEmail(email.trim());
        setScreen("mfaSetup");

        showMessage(
          "Scan this QR code with your authenticator app and enter the current code."
        );
      } else {
        showMessage(
          `Additional sign-in step required: ${
            step || "Please follow the prompt."
          }`
        );
      }
    });

  const handleConfirmMfa = () =>
    runAction(async () => {
      if (!mfaCode.trim()) {
        throw new Error("Please enter your verification code.");
      }

      const result = await confirmSignIn({
        challengeResponse: mfaCode.trim(),
      });

      if (result.isSignedIn) {
        setMfaCode("");
        await loadCurrentUser();

        addActivity("MFA verification completed");
        addActivity("Successful sign-in");

        showMessage("MFA verification successful.");
      } else {
        const nextStep = result.nextStep as any;
        const step = nextStep.signInStep;

        if (step === "CONTINUE_SIGN_IN_WITH_TOTP_SETUP") {
          const uri =
            nextStep.totpSetupDetails.getSetupUri("SecureSphereWeb");

          setTotpUri(uri.toString());
          setMfaSetupMode("signin");
          setMfaCode("");
          setScreen("mfaSetup");

          showMessage(
            "Scan the QR code with your authenticator app, then enter its current code."
          );
        } else {
          showMessage(
            `Another verification step is required: ${
              step || "Please try again."
            }`
          );
        }
      }
    });

  const handleMfaSetup = () =>
    runAction(async () => {
      const details = await setUpTOTP();
      const setupUri = details.getSetupUri("SecureSphereWeb");

      setTotpUri(setupUri.toString());
      setMfaCode("");
      setMfaSetupMode("account");
      setScreen("mfaSetup");

      showMessage(
        "Scan the QR code with your authenticator app, then enter its current code."
      );
    });

  const handleVerifyMfaSetup = () =>
    runAction(async () => {
      if (!mfaCode.trim()) {
        throw new Error("Please enter the 6-digit authenticator code.");
      }

      if (mfaSetupMode === "signin") {
        const result = await confirmSignIn({
          challengeResponse: mfaCode.trim(),
        });

        if (!result.isSignedIn) {
          throw new Error(
            "MFA setup is not complete. Please try again."
          );
        }

        setTotpUri("");
        setMfaCode("");

        await loadCurrentUser();

        setMfaEnabled(true);
        addActivity("Authenticator app setup completed");
        addActivity("MFA verification completed");
        addActivity("Successful sign-in");

        showMessage("MFA verification successful.");
      } else {
        await verifyTOTPSetup({
          code: mfaCode.trim(),
        });

        await updateMFAPreference({
          totp: "PREFERRED",
        });

        setTotpUri("");
        setMfaCode("");
        setMfaEnabled(true);
        setScreen("home");

        addActivity("Authenticator app enabled");

        showMessage("Authenticator app MFA has been enabled.");
      }
    });

  const handleForgotPassword = () =>
    runAction(async () => {
      if (!email.trim()) {
        throw new Error("Please enter your email address.");
      }

      const result = await resetPassword({
        username: email.trim(),
      });

      if (
        result.nextStep.resetPasswordStep ===
        "CONFIRM_RESET_PASSWORD_WITH_CODE"
      ) {
        setUserEmail(email.trim());
        setScreen("resetPassword");

        showMessage(
          "Enter the code sent to your email and choose a new password."
        );
      } else {
        setScreen("login");
        showMessage("Follow the instructions to reset your password.");
      }
    });

  const handleResetPassword = () =>
    runAction(async () => {
      if (!verificationCode.trim() || !password) {
        throw new Error(
          "Enter the verification code and new password."
        );
      }

      if (password !== confirmPassword) {
        throw new Error("Passwords do not match.");
      }

      await confirmResetPassword({
        username: userEmail || email.trim(),
        confirmationCode: verificationCode.trim(),
        newPassword: password,
      });

      setPassword("");
      setConfirmPassword("");
      setVerificationCode("");
      setScreen("login");

      showMessage("Password reset successfully. Please sign in.");
    });

  const handleSignOut = () =>
    runAction(async () => {
      await signOut();

      addActivity("Signed out");

      setEmail("");
      setPassword("");
      setConfirmPassword("");
      setVerificationCode("");
      setMfaCode("");
      setTotpUri("");
      setUserEmail("");
      setUserId("");
      setMfaEnabled(false);

      setScreen("login");
      showMessage("You have been signed out.");
    });

  const inputStyle: CSSProperties = {
    width: "100%",
    padding: "12px 14px",
    marginTop: "7px",
    marginBottom: "15px",
    border: "1px solid #cbd5e1",
    borderRadius: "9px",
    fontSize: "15px",
    boxSizing: "border-box",
    outline: "none",
  };

  const buttonStyle: CSSProperties = {
    width: "100%",
    padding: "12px",
    border: "none",
    borderRadius: "9px",
    background: "#2563eb",
    color: "white",
    fontSize: "15px",
    fontWeight: 600,
    cursor: loading ? "not-allowed" : "pointer",
    opacity: loading ? 0.7 : 1,
    marginTop: "8px",
  };

  const secondaryButtonStyle: CSSProperties = {
    ...buttonStyle,
    background: "#e2e8f0",
    color: "#1e293b",
  };

  const linkStyle: CSSProperties = {
    color: "#2563eb",
    cursor: "pointer",
    fontWeight: 600,
    background: "none",
    border: "none",
    padding: 0,
    fontSize: "14px",
  };

  const cardStyle: CSSProperties = {
    width: "100%",
    maxWidth: "470px",
    padding: "32px",
    borderRadius: "18px",
    background: "white",
    boxShadow: "0 12px 40px rgba(15, 23, 42, 0.10)",
    boxSizing: "border-box",
  };

  const labelStyle: CSSProperties = {
    display: "block",
    color: "#334155",
    fontSize: "14px",
    fontWeight: 600,
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f1f5f9",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        fontFamily: "Arial, sans-serif",
        color: "#0f172a",
      }}
    >
      <div style={cardStyle}>
        <div style={{ textAlign: "center", marginBottom: "25px" }}>
          <div
            style={{
              fontSize: "14px",
              fontWeight: 800,
              letterSpacing: "2px",
              color: "#2563eb",
              marginBottom: "8px",
            }}
          >
            SECURESPHERE
          </div>

          <h1 style={{ fontSize: "26px", margin: "0 0 8px" }}>
            {screen === "home"
              ? "SecureSphere Dashboard"
              : screen === "signup"
              ? "Create Account"
              : screen === "verifyEmail"
              ? "Verify Email"
              : screen === "forgotPassword"
              ? "Forgot Password"
              : screen === "resetPassword"
              ? "Reset Password"
              : screen === "mfaSetup"
              ? "Set Up Authenticator"
              : screen === "mfaVerify"
              ? "MFA Verification"
              : "Welcome Back"}
          </h1>

          <p style={{ color: "#64748b", margin: 0, fontSize: "14px" }}>
            {screen === "home"
              ? "Your account security workspace"
              : "Secure access to your account"}
          </p>
        </div>

        {message && (
          <div
            style={{
              padding: "12px",
              background: "#ecfdf5",
              color: "#047857",
              border: "1px solid #a7f3d0",
              borderRadius: "9px",
              marginBottom: "16px",
              fontSize: "14px",
              lineHeight: 1.5,
            }}
          >
            {message}
          </div>
        )}

        {error && (
          <div
            style={{
              padding: "12px",
              background: "#fef2f2",
              color: "#b91c1c",
              border: "1px solid #fecaca",
              borderRadius: "9px",
              marginBottom: "16px",
              fontSize: "14px",
              lineHeight: 1.5,
            }}
          >
            {error}
          </div>
        )}

        {screen === "login" && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSignIn();
            }}
          >
            <label style={labelStyle}>
              Email
              <input
                style={inputStyle}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                required
              />
            </label>

            <label style={labelStyle}>
              Password
              <input
                style={inputStyle}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
              />
            </label>

            <button
              style={buttonStyle}
              type="submit"
              disabled={loading}
            >
              {loading ? "Please wait..." : "Sign In"}
            </button>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginTop: "20px",
                gap: "12px",
              }}
            >
              <button
                type="button"
                style={linkStyle}
                onClick={() => {
                  setError("");
                  setMessage("");
                  setScreen("signup");
                }}
              >
                Create account
              </button>

              <button
                type="button"
                style={linkStyle}
                onClick={() => {
                  setError("");
                  setMessage("");
                  setScreen("forgotPassword");
                }}
              >
                Forgot password?
              </button>
            </div>
          </form>
        )}

        {screen === "signup" && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSignUp();
            }}
          >
            <label style={labelStyle}>
              Email
              <input
                style={inputStyle}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                required
              />
            </label>

            <label style={labelStyle}>
              Password
              <input
                style={inputStyle}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Create a password"
                required
              />
            </label>

            <label style={labelStyle}>
              Confirm Password
              <input
                style={inputStyle}
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm your password"
                required
              />
            </label>

            <button
              style={buttonStyle}
              type="submit"
              disabled={loading}
            >
              {loading ? "Creating account..." : "Sign Up"}
            </button>

            <p style={{ textAlign: "center", marginTop: "20px" }}>
              Already have an account?{" "}
              <button
                type="button"
                style={linkStyle}
                onClick={() => {
                  setError("");
                  setMessage("");
                  setScreen("login");
                }}
              >
                Sign in
              </button>
            </p>
          </form>
        )}

        {screen === "verifyEmail" && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleConfirmSignUp();
            }}
          >
            <p style={{ color: "#64748b", fontSize: "14px" }}>
              Enter the verification code sent to your email address.
            </p>

            <label style={labelStyle}>
              Verification Code
              <input
                style={inputStyle}
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
                placeholder="Enter verification code"
                required
              />
            </label>

            <button
              style={buttonStyle}
              type="submit"
              disabled={loading}
            >
              {loading ? "Verifying..." : "Verify Email"}
            </button>
          </form>
        )}

        {screen === "forgotPassword" && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleForgotPassword();
            }}
          >
            <p style={{ color: "#64748b", fontSize: "14px" }}>
              Enter your account email to receive a password reset code.
            </p>

            <label style={labelStyle}>
              Email
              <input
                style={inputStyle}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                required
              />
            </label>

            <button
              style={buttonStyle}
              type="submit"
              disabled={loading}
            >
              {loading ? "Sending..." : "Send Reset Code"}
            </button>

            <p style={{ textAlign: "center", marginTop: "20px" }}>
              <button
                type="button"
                style={linkStyle}
                onClick={() => setScreen("login")}
              >
                Back to sign in
              </button>
            </p>
          </form>
        )}

        {screen === "resetPassword" && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleResetPassword();
            }}
          >
            <label style={labelStyle}>
              Verification Code
              <input
                style={inputStyle}
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
                placeholder="Enter reset code"
                required
              />
            </label>

            <label style={labelStyle}>
              New Password
              <input
                style={inputStyle}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter new password"
                required
              />
            </label>

            <label style={labelStyle}>
              Confirm New Password
              <input
                style={inputStyle}
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                required
              />
            </label>

            <button
              style={buttonStyle}
              type="submit"
              disabled={loading}
            >
              {loading ? "Resetting..." : "Reset Password"}
            </button>
          </form>
        )}

        {screen === "mfaVerify" && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleConfirmMfa();
            }}
          >
            <p style={{ color: "#64748b", fontSize: "14px" }}>
              Enter the verification code requested by your account.
            </p>

            <label style={labelStyle}>
              Verification Code
              <input
                style={inputStyle}
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value)}
                placeholder="Enter 6-digit code"
                inputMode="numeric"
                required
              />
            </label>

            <button
              style={buttonStyle}
              type="submit"
              disabled={loading}
            >
              {loading ? "Verifying..." : "Verify"}
            </button>
          </form>
        )}

        {screen === "mfaSetup" && (
          <div>
            <p
              style={{
                color: "#64748b",
                fontSize: "14px",
                lineHeight: 1.6,
                textAlign: "center",
              }}
            >
              Open an authenticator app, such as Google Authenticator
              or Microsoft Authenticator, and scan this QR code.
            </p>

            {totpUri && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  padding: "20px",
                  background: "white",
                }}
              >
                <QRCodeSVG value={totpUri} size={210} />
              </div>
            )}

            <label style={labelStyle}>
              Authenticator Code
              <input
                style={inputStyle}
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value)}
                placeholder="Enter current 6-digit code"
                inputMode="numeric"
                required
              />
            </label>

            <button
              style={buttonStyle}
              type="button"
              onClick={handleVerifyMfaSetup}
              disabled={loading}
            >
              {loading ? "Verifying..." : "Verify and Enable MFA"}
            </button>

            <button
              style={secondaryButtonStyle}
              type="button"
              onClick={() => {
                setTotpUri("");
                setMfaCode("");
                setError("");
                setMessage("");
                setScreen(
                  mfaSetupMode === "signin" ? "login" : "home"
                );
              }}
              disabled={loading}
            >
              Cancel
            </button>
          </div>
        )}

        {screen === "home" && (
          <div>
            <div
              style={{
                border: "1px solid #e2e8f0",
                borderRadius: "12px",
                padding: "16px",
                marginBottom: "18px",
              }}
            >
              <h3 style={{ margin: "0 0 15px", fontSize: "17px" }}>
                Authentication Status
              </h3>

              <div style={{ marginBottom: "14px" }}>
                <p
                  style={{
                    color: "#64748b",
                    fontSize: "12px",
                    margin: "0 0 5px",
                  }}
                >
                  Status
                </p>
                <strong style={{ color: "#059669" }}>
                  Authenticated
                </strong>
              </div>

              <div style={{ marginBottom: "14px" }}>
                <p
                  style={{
                    color: "#64748b",
                    fontSize: "12px",
                    margin: "0 0 5px",
                  }}
                >
                  Signed-in email
                </p>
                <strong style={{ overflowWrap: "anywhere" }}>
                  {userEmail}
                </strong>
              </div>

              <div>
                <p
                  style={{
                    color: "#64748b",
                    fontSize: "12px",
                    margin: "0 0 5px",
                  }}
                >
                  User ID
                </p>
                <strong
                  style={{
                    fontSize: "12px",
                    overflowWrap: "anywhere",
                  }}
                >
                  {userId}
                </strong>
              </div>
            </div>

            <div
              style={{
                border: "1px solid #e2e8f0",
                borderRadius: "12px",
                padding: "16px",
                marginBottom: "18px",
              }}
            >
              <h3 style={{ margin: "0 0 10px", fontSize: "17px" }}>
                Two-Factor Authentication
              </h3>

              {mfaEnabled ? (
                <div
                  style={{
                    padding: "12px",
                    borderRadius: "9px",
                    background: "#ecfdf5",
                    color: "#047857",
                    border: "1px solid #a7f3d0",
                    fontSize: "14px",
                    fontWeight: 600,
                  }}
                >
                  ✓ Authenticator app verified
                </div>
              ) : (
                <>
                  <p
                    style={{
                      color: "#64748b",
                      fontSize: "14px",
                      lineHeight: 1.5,
                    }}
                  >
                    Add an authenticator app to provide an additional
                    sign-in verification step.
                  </p>

                  <button
                    style={buttonStyle}
                    type="button"
                    onClick={handleMfaSetup}
                    disabled={loading}
                  >
                    {loading ? "Please wait..." : "Set up authenticator"}
                  </button>
                </>
              )}
            </div>

            <div
              style={{
                border: "1px solid #e2e8f0",
                borderRadius: "12px",
                padding: "16px",
                marginBottom: "18px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "10px",
                  marginBottom: "12px",
                }}
              >
                <h3 style={{ margin: 0, fontSize: "17px" }}>
                  Security Activity
                </h3>

                <span
                  style={{
                    fontSize: "11px",
                    color: "#64748b",
                    background: "#f1f5f9",
                    padding: "5px 8px",
                    borderRadius: "20px",
                  }}
                >
                  Current session
                </span>
              </div>

              {activities.length === 0 ? (
                <p
                  style={{
                    color: "#64748b",
                    fontSize: "14px",
                    lineHeight: 1.5,
                    marginBottom: 0,
                  }}
                >
                  No activity recorded in this session yet.
                </p>
              ) : (
                <div>
                  {activities.map((activity, index) => (
                    <div
                      key={activity.id}
                      style={{
                        display: "flex",
                        gap: "10px",
                        padding: "11px 0",
                        borderBottom:
                          index === activities.length - 1
                            ? "none"
                            : "1px solid #e2e8f0",
                      }}
                    >
                      <div
                        style={{
                          width: "30px",
                          height: "30px",
                          flexShrink: 0,
                          borderRadius: "50%",
                          background: "#eff6ff",
                          color: "#2563eb",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "14px",
                        }}
                      >
                        {activity.event.toLowerCase().includes("sign")
                          ? "↪"
                          : activity.event
                              .toLowerCase()
                              .includes("mfa") ||
                            activity.event
                              .toLowerCase()
                              .includes("authenticator")
                          ? "✓"
                          : "•"}
                      </div>

                      <div style={{ minWidth: 0 }}>
                        <strong
                          style={{
                            display: "block",
                            fontSize: "13px",
                            fontWeight: 600,
                            overflowWrap: "anywhere",
                          }}
                        >
                          {activity.event}
                        </strong>

                        <span
                          style={{
                            display: "block",
                            color: "#64748b",
                            fontSize: "11px",
                            marginTop: "4px",
                          }}
                        >
                          {activity.time}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button
              style={secondaryButtonStyle}
              type="button"
              onClick={handleSignOut}
              disabled={loading}
            >
              {loading ? "Signing out..." : "Sign Out"}
            </button>

            <p
              style={{
                color: "#94a3b8",
                textAlign: "center",
                fontSize: "12px",
                marginTop: "20px",
              }}
            >
              Protected with Amazon Cognito authentication
            </p>
          </div>
        )}
      </div>
    </div>
  );
}