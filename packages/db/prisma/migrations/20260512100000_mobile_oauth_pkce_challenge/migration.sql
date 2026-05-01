-- Mobile OAuth PKCE (P0-6 in the audit remediation plan).
--
-- Adds a NULLABLE `codeChallenge` column to MobileOAuthCode. New mobile
-- builds generate a code_verifier locally, send the SHA-256 challenge
-- to the server during OAuth init, and present the verifier when
-- exchanging the code at /api/mobile/auth/exchange. The server
-- enforces sha256(verifier) == challenge before issuing a JWT, so a
-- hostile Android app that hijacks the locateflow:// custom scheme
-- cannot use the intercepted code without also stealing the verifier
-- from the legitimate app's SecureStore (a much harder attack).
--
-- The column is nullable to preserve compatibility with already-shipped
-- mobile builds that do not yet send a challenge — those builds keep
-- working unchanged. Once telemetry shows zero exchange attempts
-- without a verifier on a row that has a challenge, a follow-up
-- migration can make the column NOT NULL.

ALTER TABLE `MobileOAuthCode`
  ADD COLUMN `codeChallenge` VARCHAR(128) NULL;
