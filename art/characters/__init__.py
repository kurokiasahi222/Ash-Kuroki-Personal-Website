"""Character modules: `ash.py` (WP-13).

    def build(ctx) -> bpy.types.Collection

Must match overview § 6.3 exactly: the armature root (with extras walkSpeed and
footstepTimes), the § 6.3 bone names, actions named idle / walk / interact, the
UMBRELLA mesh parented to hand.R, and DYN_ / GLASS_ materials only. Until it
exists, `build.py ash` builds the placeholder in `art/lib/greybox/ash.py`.
"""
