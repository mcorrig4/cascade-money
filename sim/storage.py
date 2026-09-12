"""Immutable two-level radix maps with exact journals of changed records.

Updates share all untouched leaves. Journals refer weakly to parents so previous
snapshots are not retained. A structural diff remains available for unrelated
maps or collected intermediate snapshots. CRC32 fixes iteration across seeds.
"""
from collections.abc import Mapping, Set
from dataclasses import dataclass
from functools import lru_cache
from types import MappingProxyType
from weakref import ref
from zlib import crc32

@lru_cache(maxsize=262144)
def address(key):
    value = crc32((str(key) if type(key) is int else key).encode('utf-8'))
    return value & 255, (value >> 8) & 255

def shard(key): return address(key)[0]

@dataclass(frozen=True, init=False, eq=False)
class FrozenMap(Mapping):
    _shards: tuple
    _size: int
    _parent: object
    _changes: tuple

    def __init__(self, values=()):
        buckets = [{} for _ in range(256)]
        size = 0
        for key, value in dict(values).items():
            i,j=address(key)
            buckets[i].setdefault(j,{})[key]=value
            size+=1
        object.__setattr__(self,'_shards',tuple(MappingProxyType({j:MappingProxyType(v) for j,v in b.items()}) for b in buckets))
        object.__setattr__(self,'_size',size)
        object.__setattr__(self,'_parent',None)
        object.__setattr__(self,'_changes',())
    def __getitem__(self,key):
        i,j=address(key)
        return self._shards[i][j][key]
    def __iter__(self):
        for b in self._shards:
            for leaf in b.values(): yield from leaf
    def __len__(self): return self._size
    def items(self):
        for b in self._shards:
            for leaf in b.values(): yield from leaf.items()
    def values(self):
        for b in self._shards:
            for leaf in b.values(): yield from leaf.values()
    def updated(self, values):
        buckets=list(self._shards)
        touched, leaves={},{}
        size=self._size
        for key,value in values.items():
            i,j=address(key)
            if i not in touched: touched[i]=dict(buckets[i])
            if (i,j) not in leaves: leaves[i,j]=dict(touched[i].get(j,{}))
            leaf=leaves[i,j]
            size+=key not in leaf
            leaf[key]=value
        for (i,j),leaf in leaves.items(): touched[i][j]=MappingProxyType(leaf)
        for i,b in touched.items(): buckets[i]=MappingProxyType(b)
        result=object.__new__(type(self))
        object.__setattr__(result,'_shards',tuple(buckets))
        object.__setattr__(result,'_size',size)
        object.__setattr__(result,'_parent',ref(self))
        object.__setattr__(result,'_changes',tuple(values))
        return result
    def difference(self, previous):
        cursor=self
        changes=set()
        for _ in range(4):
            if cursor is previous:
                return tuple(k for k in sorted(changes) if self[k] is not previous.get(k)), ()
            changes.update(cursor._changes)
            cursor=cursor._parent() if cursor._parent else None
            if cursor is None: break
        changed, removed=[],[]
        for old,new in zip(previous._shards,self._shards):
            if old is new: continue
            for j in old.keys() | new.keys():
                a,b=old.get(j,{}),new.get(j,{})
                if a is b: continue
                changed.extend(k for k,v in b.items() if v is not a.get(k))
                removed.extend(a.keys()-b.keys())
        return tuple(changed),tuple(removed)
    def __eq__(self,other):
        if self is other:return True
        if isinstance(other,FrozenMap):
            if len(self)!=len(other):return False
            changed,removed=self.difference(other)
            return not removed and all(self[k]==other.get(k) for k in changed)
        if isinstance(other,Mapping):return dict(self.items())==dict(other.items())
        return NotImplemented

@dataclass(frozen=True, init=False, eq=False)
class FrozenSet(Set):
    _map: FrozenMap
    def __init__(self,values=()):object.__setattr__(self,'_map',FrozenMap({v:True for v in values}))
    def __iter__(self):return iter(self._map)
    def __len__(self):return len(self._map)
    def __contains__(self,value):return value in self._map
    def __or__(self,values):
        result=object.__new__(type(self))
        object.__setattr__(result,'_map',self._map.updated({v:True for v in values}))
        return result
    def added_since(self,previous):return self._map.difference(previous._map)
    def __eq__(self,other):
        if isinstance(other,FrozenSet):return self._map==other._map
        if isinstance(other,Set):return len(self)==len(other) and all(v in other for v in self)
        return NotImplemented
