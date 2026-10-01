
import { useEffect, useState, type CSSProperties } from "react";
import {
  signUp,
  confirmSignUp,
  resendSignUpCode,
  signIn,
  signOut,
  getCurrentUser,
  resetPassword,
  confirmResetPassword,
} from "aws-amplify/auth";

type Screen = "login" | "signup" | "verify" | "forgot" | "reset" | "home";

export default function App() {
  const [screen, setScreen] = useState<Screen>("login");
  const [checkingSession, setCheckingSession] = useState(true);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [username, setUsername] = useState("");
  const [authenticatedEmail, setAuthenticatedEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const checkExistingSession = async () => {
      try {
        const user = await getCurrentUser();
        setUsername(user.username);
        setAuthenticatedEmail(
          user.signInDetails?.loginId ?? user.username
        );
        setScreen("home");
      } catch {
        setScreen("login");
      } finally {
        setCheckingSession(false);
      }
    };

    checkExistingSession();
  }, []);

  const clearMessages = () => {
    setError("");
    setMessage("");
  };

  const runAction = async (action: () => Promise<void>) => {
    clearMessages();
    setLoading(true);

    try {
      await action();
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : "Something went wrong.";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = () =>
    runAction(async () => {
      const normalizedEmail = email.trim().toLowerCase();

      const result = await signUp({
        username: normalizedEmail,
        password,
        options: {
          userAttributes: {
            email: normalizedEmail,
            name: name.trim(),
          },
        },
      });

      if (result.nextStep.signUpStep === "CONFIRM_SIGN_UP") {
        setScreen("verify");
        setMessage("A verification code has been sent to your email.");
      } else {
        setMessage("Registration submitted.");
      }
    });

  const handleVerify = () =>
    runAction(async () => {
      await confirmSignUp({
        username: email.trim().toLowerCase(),
        confirmationCode: code.trim(),
      });

      setScreen("login");
      setPassword("");
      setCode("");
      setMessage("Email verified. You can now sign in.");
    });

  const handleResendCode = () =>
    runAction(async () => {
      await resendSignUpCode({
        username: email.trim().toLowerCase(),
      });

      setMessage("A new verification code has been sent.");
    });

  const handleSignIn = () =>
    runAction(async () => {
      try {
        const existingUser = await getCurrentUser();
        setUsername(existingUser.username);
        setAuthenticatedEmail(
          existingUser.signInDetails?.loginId ?? existingUser.username
        );
        setScreen("home");
        setMessage("You are already signed in.");
        return;
      } catch {
        // No existing signed-in user; continue with sign-in.
      }

      const result = await signIn({
        username: email.trim().toLowerCase(),
        password,
      });

      if (result.isSignedIn) {
        const user = await getCurrentUser();
        setUsername(user.username);
        setAuthenticatedEmail(
          user.signInDetails?.loginId ?? user.username
        );
        setScreen("home");
        setPassword("");
      } else {
        setMessage(
          `Additional sign-in step required: ${result.nextStep.signInStep}`
        );
      }
    });

  const handleForgotPassword = () =>
    runAction(async () => {
      const result = await resetPassword({
        username: email.trim().toLowerCase(),
      });

      if (
        result.nextStep.resetPasswordStep ===
        "CONFIRM_RESET_PASSWORD_WITH_CODE"
      ) {
        setScreen("reset");
        setMessage("A password reset code has been sent to your email.");
      } else {
        setMessage("Continue with the next password-reset step.");
      }
    });

  const handleResetPassword = () =>
    runAction(async () => {
      await confirmResetPassword({
        username: email.trim().toLowerCase(),
        confirmationCode: code.trim(),
        newPassword,
      });

      setScreen("login");
      setPassword("");
      setNewPassword("");
      setCode("");
      setMessage("Password reset successfully. Please sign in.");
    });

  const handleSignOut = () =>
    runAction(async () => {
      await signOut();
      setUsername("");
      setAuthenticatedEmail("");
      setPassword("");
      setScreen("login");
      setMessage("You have been signed out.");
    });

  const inputStyle: CSSProperties = {
    width: "100%",
    boxSizing: "border-box",
    padding: "13px 14px",
    marginTop: 7,
    border: "1px solid #d5dbe5",
    borderRadius: 10,
    fontSize: 15,
    outlineColor: "#2563eb",
  };

  const buttonStyle: CSSProperties = {
    width: "100%",
    padding: 14,
    background: "#2563eb",
    color: "white",
    border: 0,
    borderRadius: 10,
    fontSize: 16,
    fontWeight: 600,
    cursor: "pointer",
    marginTop: 14,
  };

  const linkStyle: CSSProperties = {
    color: "#2563eb",
    border: 0,
    background: "none",
    cursor: "pointer",
    fontWeight: 600,
    padding: 5,
  };

  const field = (
    label: string,
    value: string,
    setter: (value: string) => void,
    type = "text",
    placeholder = ""
  ) => (
    <label style={{ display: "block", marginTop: 14, color: "#344054" }}>
      <span style={{ fontSize: 14, fontWeight: 600 }}>{label}</span>
      <input
        style={inputStyle}
        type={type}
        value={value}
        onChange={(event) => setter(event.target.value)}
        placeholder={placeholder}
        required
      />
    </label>
  );

  const titles: Record<Screen, string> = {
    login: "Welcome back",
    signup: "Create your account",
    verify: "Verify your email",
    forgot: "Forgot password?",
    reset: "Reset your password",
    home: "Secure dashboard",
  };

  const changeScreen = (nextScreen: Screen) => {
    clearMessages();
    setScreen(nextScreen);
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        boxSizing: "border-box",
        background:
          "linear-gradient(135deg, #eff6ff, #f8fafc 55%, #e0e7ff)",
        fontFamily: "Arial, sans-serif",
        color: "#101828",
      }}
    >
      <section
        style={{
          width: "100%",
          maxWidth: 430,
          padding: 32,
          boxSizing: "border-box",
          background: "white",
          borderRadius: 20,
          boxShadow: "0 18px 55px rgba(30, 64, 175, 0.12)",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 26 }}>
          <div
            style={{
              width: 54,
              height: 54,
              margin: "0 auto 12px",
              borderRadius: 16,
              background: "#dbeafe",
              color: "#1d4ed8",
              display: "grid",
              placeItems: "center",
              fontSize: 27,
              fontWeight: 800,
            }}
          >
            S
          </div>

          <h1 style={{ margin: 0, fontSize: 26, color: "#101828" }}>
  SecureSphere
</h1>
          <p style={{ color: "#667085", marginBottom: 0 }}>
            Secure authentication for your digital world
          </p>
        </div>

        {checkingSession ? (
          <p style={{ textAlign: "center", color: "#667085" }}>
            Checking your secure session...
          </p>
        ) : (
          <>
            <h2 style={{ fontSize: 21, marginBottom: 8, color: "#101828" }}>
  {titles[screen]}
</h2>

            {screen === "home" ? (
              <>
                <p style={{ color: "#667085", lineHeight: 1.6 }}>
                  You are signed in as:
                  <br />
                  <strong>{authenticatedEmail || username}</strong>
                </p>

                <div
                  style={{
                    background: "#ecfdf3",
                    color: "#027a48",
                    padding: 14,
                    borderRadius: 10,
                    marginTop: 20,
                  }}
                >
                  <strong>✓ Authentication successful</strong>
                  <p style={{ marginBottom: 0 }}>
                    Your session is managed by Amazon Cognito.
                  </p>
                </div>

                <button
                  style={buttonStyle}
                  onClick={handleSignOut}
                  disabled={loading}
                >
                  {loading ? "Please wait..." : "Sign out"}
                </button>
              </>
            ) : (
              <>
                {screen === "signup" && (
                  <>
                    {field("Full name", name, setName, "text", "Your name")}
                    {field(
                      "Email address",
                      email,
                      setEmail,
                      "email",
                      "you@example.com"
                    )}
                    {field(
                      "Password",
                      password,
                      setPassword,
                      "password",
                      "Create a password"
                    )}

                    <button
                      style={buttonStyle}
                      onClick={handleSignUp}
                      disabled={loading}
                    >
                      {loading ? "Creating account..." : "Create account"}
                    </button>
                  </>
                )}

                {screen === "login" && (
                  <>
                    {field(
                      "Email address",
                      email,
                      setEmail,
                      "email",
                      "you@example.com"
                    )}
                    {field(
                      "Password",
                      password,
                      setPassword,
                      "password",
                      "Enter your password"
                    )}

                    <div style={{ textAlign: "right", marginTop: 8 }}>
                      <button
                        style={linkStyle}
                        onClick={() => changeScreen("forgot")}
                      >
                        Forgot password?
                      </button>
                    </div>

                    <button
                      style={buttonStyle}
                      onClick={handleSignIn}
                      disabled={loading}
                    >
                      {loading ? "Signing in..." : "Sign in"}
                    </button>
                  </>
                )}

                {screen === "verify" && (
                  <>
                    <p style={{ color: "#667085", lineHeight: 1.5 }}>
                      Enter the confirmation code sent to {email}.
                    </p>

                    {field(
                      "Verification code",
                      code,
                      setCode,
                      "text",
                      "Enter code"
                    )}

                    <button
                      style={buttonStyle}
                      onClick={handleVerify}
                      disabled={loading}
                    >
                      {loading ? "Verifying..." : "Verify email"}
                    </button>

                    <div style={{ textAlign: "center", marginTop: 12 }}>
                      <button
                        style={linkStyle}
                        onClick={handleResendCode}
                        disabled={loading}
                      >
                        Resend code
                      </button>
                    </div>
                  </>
                )}

                {screen === "forgot" && (
                  <>
                    <p style={{ color: "#667085", lineHeight: 1.5 }}>
                      Enter your account email to receive a password reset
                      code.
                    </p>

                    {field(
                      "Email address",
                      email,
                      setEmail,
                      "email",
                      "you@example.com"
                    )}

                    <button
                      style={buttonStyle}
                      onClick={handleForgotPassword}
                      disabled={loading}
                    >
                      {loading ? "Sending..." : "Send reset code"}
                    </button>
                  </>
                )}

                {screen === "reset" && (
                  <>
                    {field(
                      "Reset code",
                      code,
                      setCode,
                      "text",
                      "Enter email code"
                    )}
                    {field(
                      "New password",
                      newPassword,
                      setNewPassword,
                      "password",
                      "Enter new password"
                    )}

                    <button
                      style={buttonStyle}
                      onClick={handleResetPassword}
                      disabled={loading}
                    >
                      {loading ? "Updating..." : "Reset password"}
                    </button>
                  </>
                )}

                {error && (
                  <p
                    role="alert"
                    style={{
                      background: "#fef3f2",
                      color: "#b42318",
                      padding: 12,
                      borderRadius: 9,
                      lineHeight: 1.4,
                      overflowWrap: "anywhere",
                    }}
                  >
                    {error}
                  </p>
                )}

                {message && (
                  <p
                    role="status"
                    style={{
                      background: "#eff8ff",
                      color: "#175cd3",
                      padding: 12,
                      borderRadius: 9,
                      lineHeight: 1.4,
                    }}
                  >
                    {message}
                  </p>
                )}

                <div
                  style={{
                    textAlign: "center",
                    marginTop: 20,
                    color: "#667085",
                  }}
                >
                  {screen === "login" && (
                    <>
                      Don't have an account?{" "}
                      <button
                        style={linkStyle}
                        onClick={() => changeScreen("signup")}
                      >
                        Sign up
                      </button>
                    </>
                  )}

                  {screen === "signup" && (
                    <>
                      Already registered?{" "}
                      <button
                        style={linkStyle}
                        onClick={() => changeScreen("login")}
                      >
                        Sign in
                      </button>
                    </>
                  )}

                  {(screen === "verify" ||
                    screen === "forgot" ||
                    screen === "reset") && (
                    <button
                      style={linkStyle}
                      onClick={() => changeScreen("login")}
                    >
                      Back to sign in
                    </button>
                  )}
                </div>
              </>
            )}
          </>
        )}

        <p
          style={{
            textAlign: "center",
            color: "#98a2b3",
            fontSize: 12,
            marginTop: 28,
            marginBottom: 0,
          }}
        >
          Powered by Amazon Cognito
        </p>
      </section>
    </main>
  );
}