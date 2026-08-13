data "aws_iam_policy_document" "github_actions_trust" {
  statement {
    sid     = "GitHubActionsWebIdentityOnly"
    effect  = "Allow"
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [var.oidc_provider_arn]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }

    # Pin the trust boundary to this repository's main branch. A future
    # release workflow must still receive GitHub environment approval before
    # it can use a separately attached, least-privilege deployment policy.
    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      values   = ["repo:${var.github_repository}:ref:refs/heads/main"]
    }
  }
}

resource "aws_iam_role" "github_actions_trust" {
  name                 = "${var.name_prefix}-github-actions-trust"
  assume_role_policy   = data.aws_iam_policy_document.github_actions_trust.json
  max_session_duration = 3600

  # Deliberately permissionless. Module-specific least-privilege policies are
  # attached only alongside the managed resources they need to change. This
  # prevents a reusable CI role from quietly accumulating broad AWS access.
  tags = var.tags
}
