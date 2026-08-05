from __future__ import annotations

MASK32 = 0xFFFFFFFF
FNV_OFFSET = 2166136261
FNV_PRIME = 16777619

def fnv1a(s: str) -> int:
    h = FNV_OFFSET
    for ch in s:
        h = (h ^ (ord(ch) & 0xFFFF)) & MASK32
        h = (h * FNV_PRIME) & MASK32
    return h

def sky_position(asset_id: str) -> tuple[float, float]:
    h = fnv1a(asset_id)
    return (h % 1000) / 10, ((h >> 10) % 1000) / 10
