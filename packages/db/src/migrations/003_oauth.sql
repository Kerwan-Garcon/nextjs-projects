-- Google sign-in.
--
-- Identities live in their own table rather than as columns on `users`, for two
-- reasons. A researcher may end up with more than one way in, and the platform
-- should not care which one they used. And the provider's claims about them -
-- the email, the name, the picture - are the provider's, not ours: keeping them
-- separate from the handle and the reputation makes it obvious which fields the
-- platform owns and which it merely received.

CREATE TABLE oauth_identities (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider       TEXT NOT NULL,
  -- The provider's stable identifier for the person. Never the email: an email
  -- can be reassigned, and Google says so explicitly.
  subject        TEXT NOT NULL,
  user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email          TEXT,
  email_verified BOOLEAN NOT NULL DEFAULT false,
  display_name   TEXT,
  picture_url    TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider, subject)
);
CREATE INDEX oauth_identities_user_idx ON oauth_identities(user_id);
CREATE INDEX oauth_identities_email_idx ON oauth_identities(email);

-- Short-lived state for an in-flight authorisation request. Rows are consumed
-- on callback and swept by age, so an abandoned sign-in leaves nothing behind.
CREATE TABLE oauth_states (
  state          TEXT PRIMARY KEY,
  provider       TEXT NOT NULL,
  -- PKCE verifier. Stored server-side so the code exchange cannot be completed
  -- by anyone who only intercepted the redirect.
  code_verifier  TEXT NOT NULL,
  nonce          TEXT NOT NULL,
  redirect_to    TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at     TIMESTAMPTZ NOT NULL
);
CREATE INDEX oauth_states_expiry_idx ON oauth_states(expires_at);
