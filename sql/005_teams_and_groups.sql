-- Migration 005 — teams and groups
--
-- Builds on 003_access_control.sql (in bapps-edp-analytics-mcp/semantic/migrations/).
-- Access now goes to groups, not to individual people:
--
--   a person is in a group  →  the group has roles  →  each role lists what it can see
--
--   teams ──< team_admins
--   teams ──< groups ──< group_members >── users
--                    └──< group_roles  >── roles ──< role_permissions
--
-- Who can change what (enforced by the access-control-ui backend):
--   * global admins (ADMIN_EMAILS)  teams, team admins, roles, permissions, everything below
--   * team admins                   their own team's groups, members, and adding
--                                   their own team's roles to those groups
--
-- Nothing is removed: user_roles (direct grants) stays, and effective_access
-- still honours open direct grants until they have been moved into groups.
--
-- Run once per environment, AFTER 003 (substitute the project for stg/prod):
--   bq query --use_legacy_sql=false --project_id=ent-data-warehouse-dev \
--     < sql/005_teams_and_groups.sql
--
-- Then copy this file into bapps-edp-analytics-mcp/semantic/migrations/ so the
-- agent's repo has the same view definition.
--
-- Note: GROUPS is a reserved word in BigQuery. Always write the table name in
-- backticks with its full path, as below.

-- ───────────────────────────────────────────────────────────────────────────
-- roles.team_id — which team owns a role
-- ───────────────────────────────────────────────────────────────────────────
-- NULL = no team: only global admins can add it to a group (e.g. exec).
-- owner_team (text) stays and is kept equal to the team's name for readability.
ALTER TABLE `ent-data-warehouse-dev.roller_analytics_agent_access_control.roles`
  ADD COLUMN IF NOT EXISTS team_id STRING
  OPTIONS(description = 'Owning team — teams.team_id. NULL = only global admins can hand it out.');

-- ───────────────────────────────────────────────────────────────────────────
-- teams — parts of Roller that manage their own groups
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `ent-data-warehouse-dev.roller_analytics_agent_access_control.teams` (
  team_id      STRING    DEFAULT GENERATE_UUID() NOT NULL OPTIONS(description = 'Internal permanent ID (UUID).'),
  team_key     STRING    NOT NULL OPTIONS(description = 'Unique lowercase snake_case name, e.g. customer_success.'),
  team_name    STRING    NOT NULL OPTIONS(description = 'Display name, e.g. Customer Success.'),
  description  STRING             OPTIONS(description = 'What the team does.'),
  is_active    BOOL      NOT NULL OPTIONS(description = 'FALSE retires the team: its groups stop giving access.'),
  created_at   TIMESTAMP NOT NULL OPTIONS(description = 'When the row was created (UTC).'),
  created_by   STRING    NOT NULL OPTIONS(description = 'Email of whoever created the row.'),
  updated_at   TIMESTAMP          OPTIONS(description = 'Last change (UTC).'),
  updated_by   STRING             OPTIONS(description = 'Email of whoever made the last change.'),
  PRIMARY KEY (team_id) NOT ENFORCED
)
OPTIONS (description = 'Teams that manage their own groups. Retire (is_active = FALSE), never delete.');

-- ───────────────────────────────────────────────────────────────────────────
-- team_admins — who manages each team's groups
-- ───────────────────────────────────────────────────────────────────────────
-- APPEND-ONLY. Removing an admin sets removed_at; rows are never deleted.
CREATE TABLE IF NOT EXISTS `ent-data-warehouse-dev.roller_analytics_agent_access_control.team_admins` (
  team_admin_id STRING    DEFAULT GENERATE_UUID() NOT NULL OPTIONS(description = 'Internal ID (UUID).'),
  team_id       STRING    NOT NULL OPTIONS(description = 'The team — teams.team_id.'),
  email         STRING    NOT NULL OPTIONS(description = 'Lowercase work email of the admin (their IAP sign-in).'),
  added_at      TIMESTAMP NOT NULL OPTIONS(description = 'When they became an admin (UTC).'),
  added_by      STRING    NOT NULL OPTIONS(description = 'Global admin who added them.'),
  removed_at    TIMESTAMP          OPTIONS(description = 'Set when they stop being an admin. NULL while current.'),
  removed_by    STRING             OPTIONS(description = 'Who removed them.'),
  PRIMARY KEY (team_admin_id) NOT ENFORCED,
  FOREIGN KEY (team_id) REFERENCES `ent-data-warehouse-dev.roller_analytics_agent_access_control.teams` (team_id) NOT ENFORCED
)
OPTIONS (description = 'Team admins. APPEND-ONLY — remove by setting removed_at, never DELETE.');

-- ───────────────────────────────────────────────────────────────────────────
-- groups — people who get the same roles; owned by one team
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `ent-data-warehouse-dev.roller_analytics_agent_access_control.groups` (
  group_id       STRING    DEFAULT GENERATE_UUID() NOT NULL OPTIONS(description = 'Internal permanent ID (UUID).'),
  group_key      STRING    NOT NULL OPTIONS(description = 'Unique lowercase snake_case name, e.g. support_analysts.'),
  group_name     STRING    NOT NULL OPTIONS(description = 'Display name, e.g. Support Analysts.'),
  description    STRING             OPTIONS(description = 'Who should be in it.'),
  team_id        STRING    NOT NULL OPTIONS(description = 'Owning team — teams.team_id. Never changes.'),
  entra_group_id STRING             OPTIONS(description = 'Optional. Entra group to sync members from later.'),
  is_active      BOOL      NOT NULL OPTIONS(description = 'FALSE retires the group: it stops giving access.'),
  created_at     TIMESTAMP NOT NULL OPTIONS(description = 'When the row was created (UTC).'),
  created_by     STRING    NOT NULL OPTIONS(description = 'Email of whoever created the row.'),
  updated_at     TIMESTAMP          OPTIONS(description = 'Last change (UTC).'),
  updated_by     STRING             OPTIONS(description = 'Email of whoever made the last change.'),
  PRIMARY KEY (group_id) NOT ENFORCED,
  FOREIGN KEY (team_id) REFERENCES `ent-data-warehouse-dev.roller_analytics_agent_access_control.teams` (team_id) NOT ENFORCED
)
OPTIONS (description = 'Groups of people. Retire (is_active = FALSE), never delete.');

-- ───────────────────────────────────────────────────────────────────────────
-- group_members — who is in which group
-- ───────────────────────────────────────────────────────────────────────────
-- APPEND-ONLY, like user_roles: removing sets removed_at. To extend, remove
-- and add again so the history shows both.
CREATE TABLE IF NOT EXISTS `ent-data-warehouse-dev.roller_analytics_agent_access_control.group_members` (
  group_member_id STRING    DEFAULT GENERATE_UUID() NOT NULL OPTIONS(description = 'Internal ID (UUID).'),
  group_id        STRING    NOT NULL OPTIONS(description = 'The group — groups.group_id.'),
  user_id         STRING    NOT NULL OPTIONS(description = 'The person — users.user_id.'),
  added_at        TIMESTAMP NOT NULL OPTIONS(description = 'When access starts (UTC). A future time means not yet active.'),
  added_by        STRING    NOT NULL OPTIONS(description = 'Admin who added them (from the sign-in).'),
  approved_by     STRING    NOT NULL OPTIONS(description = 'Approver email. Must not be the member.'),
  expires_at      TIMESTAMP          OPTIONS(description = 'When access ends (UTC). NULL = never. Avoid.'),
  removed_at      TIMESTAMP          OPTIONS(description = 'Set to end membership early. NULL while current.'),
  removed_by      STRING             OPTIONS(description = 'Who removed them.'),
  reason          STRING             OPTIONS(description = 'Why, in words.'),
  PRIMARY KEY (group_member_id) NOT ENFORCED,
  FOREIGN KEY (group_id) REFERENCES `ent-data-warehouse-dev.roller_analytics_agent_access_control.groups` (group_id) NOT ENFORCED,
  FOREIGN KEY (user_id) REFERENCES `ent-data-warehouse-dev.roller_analytics_agent_access_control.users` (user_id) NOT ENFORCED
)
OPTIONS (description = 'Group membership. APPEND-ONLY — remove by setting removed_at, never DELETE.');

-- ───────────────────────────────────────────────────────────────────────────
-- group_roles — which roles each group gives its members
-- ───────────────────────────────────────────────────────────────────────────
-- APPEND-ONLY: removing a role from a group sets revoked_at.
CREATE TABLE IF NOT EXISTS `ent-data-warehouse-dev.roller_analytics_agent_access_control.group_roles` (
  group_role_id STRING    DEFAULT GENERATE_UUID() NOT NULL OPTIONS(description = 'Internal ID (UUID).'),
  group_id      STRING    NOT NULL OPTIONS(description = 'The group — groups.group_id.'),
  role_id       STRING    NOT NULL OPTIONS(description = 'The role — roles.role_id.'),
  granted_at    TIMESTAMP NOT NULL OPTIONS(description = 'When the role was added (UTC).'),
  granted_by    STRING    NOT NULL OPTIONS(description = 'Admin who added it.'),
  revoked_at    TIMESTAMP          OPTIONS(description = 'Set when the role is removed from the group.'),
  revoked_by    STRING             OPTIONS(description = 'Who removed it.'),
  reason        STRING             OPTIONS(description = 'Why, in words.'),
  PRIMARY KEY (group_role_id) NOT ENFORCED,
  FOREIGN KEY (group_id) REFERENCES `ent-data-warehouse-dev.roller_analytics_agent_access_control.groups` (group_id) NOT ENFORCED,
  FOREIGN KEY (role_id) REFERENCES `ent-data-warehouse-dev.roller_analytics_agent_access_control.roles` (role_id) NOT ENFORCED
)
OPTIONS (description = 'Roles per group. APPEND-ONLY — revoke by setting revoked_at, never DELETE.');

-- ───────────────────────────────────────────────────────────────────────────
-- effective_access — the ONLY object the agent reads
-- ───────────────────────────────────────────────────────────────────────────
-- Same columns as before, plus group_key at the end (NULL for a direct grant).
-- The agent selects columns by name, so the new column changes nothing for it.
CREATE OR REPLACE VIEW `ent-data-warehouse-dev.roller_analytics_agent_access_control.effective_access`
OPTIONS (description = 'Current access per person, through groups (and legacy direct grants). Read by the MCP server. Code must not query the base tables.')
AS
-- Through groups: the normal way.
SELECT
  u.user_id,
  LOWER(TRIM(u.email))           AS email,
  u.entra_object_id,
  r.role_key,
  LOWER(TRIM(p.resource_type))   AS resource_type,
  LOWER(TRIM(p.resource_key))    AS resource_key,
  gm.expires_at,
  g.group_key
FROM `ent-data-warehouse-dev.roller_analytics_agent_access_control.users` u
JOIN `ent-data-warehouse-dev.roller_analytics_agent_access_control.group_members` gm
  ON gm.user_id = u.user_id
JOIN `ent-data-warehouse-dev.roller_analytics_agent_access_control.groups` g
  ON g.group_id = gm.group_id
JOIN `ent-data-warehouse-dev.roller_analytics_agent_access_control.teams` t
  ON t.team_id = g.team_id
JOIN `ent-data-warehouse-dev.roller_analytics_agent_access_control.group_roles` gr
  ON gr.group_id = g.group_id
JOIN `ent-data-warehouse-dev.roller_analytics_agent_access_control.roles` r
  ON r.role_id = gr.role_id
JOIN `ent-data-warehouse-dev.roller_analytics_agent_access_control.role_permissions` p
  ON p.role_id = r.role_id
WHERE u.is_active
  AND t.is_active
  AND g.is_active
  AND r.is_active
  AND gr.revoked_at IS NULL
  AND gm.removed_at IS NULL
  AND gm.added_at <= CURRENT_TIMESTAMP()
  AND (gm.expires_at IS NULL OR gm.expires_at > CURRENT_TIMESTAMP())

UNION ALL

-- Legacy direct grants, until they are moved into groups.
SELECT
  u.user_id,
  LOWER(TRIM(u.email))           AS email,
  u.entra_object_id,
  r.role_key,
  LOWER(TRIM(p.resource_type))   AS resource_type,
  LOWER(TRIM(p.resource_key))    AS resource_key,
  ur.expires_at,
  CAST(NULL AS STRING)           AS group_key
FROM `ent-data-warehouse-dev.roller_analytics_agent_access_control.users` u
JOIN `ent-data-warehouse-dev.roller_analytics_agent_access_control.user_roles` ur
  ON ur.user_id = u.user_id
JOIN `ent-data-warehouse-dev.roller_analytics_agent_access_control.roles` r
  ON r.role_id = ur.role_id
JOIN `ent-data-warehouse-dev.roller_analytics_agent_access_control.role_permissions` p
  ON p.role_id = r.role_id
WHERE u.is_active
  AND r.is_active
  AND ur.revoked_at IS NULL
  AND ur.granted_at <= CURRENT_TIMESTAMP()
  AND (ur.expires_at IS NULL OR ur.expires_at > CURRENT_TIMESTAMP());
