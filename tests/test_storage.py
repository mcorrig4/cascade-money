"""Structural sharing must preserve exact diffs and old atomic snapshots."""
from dataclasses import FrozenInstanceError
import os
import subprocess
import sys

import pytest
from hypothesis import given, strategies as st
from sim.storage import FrozenMap, FrozenSet


@given(st.dictionaries(st.text(min_size=1), st.integers(), max_size=100),
       st.dictionaries(st.text(min_size=1), st.integers(), max_size=30))
def test_persistent_map_matches_dict_and_detects_every_identity_change(old, changes):
    before = FrozenMap(old)
    after = before.updated(changes)
    expected = {**old, **changes}
    assert dict(before.items()) == old
    assert dict(after.items()) == expected
    changed, removed = after.difference(before)
    assert set(changed) == {k for k,v in expected.items() if v is not old.get(k)}
    assert removed == ()
    assert after == expected
    assert FrozenSet(old) | set(changes) == set(expected)
    assert set(FrozenSet(old)) == set(old)


def test_shards_cannot_be_mutated():
    records = FrozenMap({'invoice': object()})
    with pytest.raises(FrozenInstanceError):
        records._size = 0
    with pytest.raises(TypeError):
        records._shards[0]['injected'] = 1
    rebuilt = FrozenMap({'different': object()})
    changed, removed = rebuilt.difference(records)
    assert changed == ('different',)
    assert removed == ('invoice',)


def test_stream_is_identical_across_python_hash_seeds():
    script = ('import hashlib; from sim.world import run_world; '
              'r=run_world(days=5,suppliers=40,invoices=40,seed=7,retain=True); '
              'print(hashlib.sha256("\\n".join(r.vault.events.lines).encode()).hexdigest())')
    outputs = [subprocess.check_output([sys.executable, '-c', script],
               env={**os.environ, 'PYTHONHASHSEED': value}) for value in ('1', '987')]
    assert outputs[0] == outputs[1]


def test_journal_survives_collected_intermediate_without_structural_scan():
    import gc
    before=FrozenMap({'a':1})
    after=before.updated({'b':2}).updated({'c':3})
    gc.collect()
    assert after.difference(before)==(('b','c'),())
    assert any(ancestor() is before for ancestor,_ in after._journal)
    assert before.updated({}) is before
    ids=FrozenSet(['a'])
    assert (ids | set()) is ids


@given(st.lists(st.integers(),max_size=500))
def test_append_log_matches_tuple_without_copying_history(values):
    from sim.storage import AppendLog
    log=AppendLog()
    snapshots=[]
    for value in values:
        snapshots.append(log)
        log=log+(value,)
        assert len(log._tail)<=64
    assert tuple(log)==tuple(values) and log==tuple(values)
    for i,snapshot in enumerate(snapshots):
        assert tuple(snapshot)==tuple(values[:i])
        assert log[i]==values[i]
