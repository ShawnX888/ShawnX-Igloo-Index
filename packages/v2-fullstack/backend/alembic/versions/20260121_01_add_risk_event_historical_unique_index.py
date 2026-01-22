"""Add historical unique index for risk_events

Revision ID: 20260121_01
Revises: None
Create Date: 2026-01-21

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "20260121_01"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_index(
        "uq_risk_event_historical",
        "risk_events",
        ["product_id", "region_code", "timestamp", "weather_type", "tier_level"],
        unique=True,
        postgresql_where=sa.text(
            "data_type = 'historical' AND prediction_run_id IS NULL"
        ),
    )


def downgrade() -> None:
    op.drop_index("uq_risk_event_historical", table_name="risk_events")
