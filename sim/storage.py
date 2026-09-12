"""Small immutable sharded maps for atomic ledger snapshots (standard library).

Updates copy one small shard; unchanged shards are shared. Identity comparison
of every shard yields an exact record diff without rescanning unchanged records.
CRC32 makes iteration deterministic across Python hash seeds.
"""
from collections.abc import Mapping, Set
from dataclasses import dataclass
from functools import lru_cache
from types import MappingProxyType
from zlib import crc32


@lru_cache(maxsize=131072)
def shard(key):
    return crc32(key.encode("utf-8")) % 256


@dataclass(frozen=True, init=False, eq=False)
class FrozenMap(Mapping):
    _shards: tuple
    _size: int

    def __init__(self, values=()):
        buckets = [{} for _ in range(256)]
        for key, value in dict(values).items():
            buckets[shard(key)][key] = value
        object.__setattr__(self, "_shards", tuple(MappingProxyType(b) for b in buckets))
        object.__setattr__(self, "_size", sum(map(len, buckets)))

    def __getitem__(self, key):
        return self._shards[shard(key)][key]

    def __iter__(self):
        for bucket in self._shards:
            yield from bucket

    def __len__(self):
        return self._size

    def items(self):
        for bucket in self._shards:
            yield from bucket.items()

    def values(self):
        for bucket in self._shards:
            yield from bucket.values()

    def updated(self, values):
        buckets = list(self._shards)
        touched = {}
        size = self._size
        for key, value in values.items():
            index = shard(key)
            if index not in touched:
                touched[index] = dict(buckets[index])
            bucket = touched[index]
            size += key not in bucket
            bucket[key] = value
        for index, bucket in touched.items():
            buckets[index] = MappingProxyType(bucket)
        result = object.__new__(type(self))
        object.__setattr__(result, "_shards", tuple(buckets))
        object.__setattr__(result, "_size", size)
        return result

    def difference(self, previous):
        """Actual identity changes and removals, independent of operation metadata."""
        changed, removed = [], []
        for old, new in zip(previous._shards, self._shards):
            if old is not new:
                changed.extend(k for k, value in new.items() if value is not old.get(k))
                removed.extend(old.keys() - new.keys())
        return tuple(changed), tuple(removed)

    def __eq__(self, other):
        if isinstance(other, FrozenMap):
            return self._size == other._size and all(a is b or a == b for a,b in zip(self._shards, other._shards))
        if isinstance(other, Mapping):
            return dict(self.items()) == dict(other.items())
        return NotImplemented


@dataclass(frozen=True, init=False, eq=False)
class FrozenSet(Set):
    _map: FrozenMap

    def __init__(self, values=()):
        object.__setattr__(self, "_map", FrozenMap({v: True for v in values}))

    def __iter__(self):
        return iter(self._map)

    def __len__(self):
        return len(self._map)

    def __contains__(self, value):
        return value in self._map

    def __or__(self, values):
        result = object.__new__(type(self))
        object.__setattr__(result, "_map", self._map.updated({v: True for v in values}))
        return result

    def __eq__(self, other):
        if isinstance(other, FrozenSet):
            return self._map == other._map
        if isinstance(other, Set):
            return len(self) == len(other) and all(v in other for v in self)
        return NotImplemented
