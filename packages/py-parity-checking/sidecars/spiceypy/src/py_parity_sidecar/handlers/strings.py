from __future__ import annotations

import spiceypy as sp

from .. import string_oracle
from ..models import (
    StepOutput,
    WorkflowStep,
    StepStringsCpos,
    StepStringsCposr,
    StepStringsNcpos,
    StepStringsNcposr,
    StepStringsPos,
    StepStringsPosr,
    StepStringsEsrchc,
    StepStringsCmprss,
    StepStringsEqstr,
    StepStringsIswhsp,
    StepStringsLastnb,
    StepStringsLcase,
    StepStringsUcase,
    StepStringsMatchi,
    StepStringsMatchw,
)


def run_strings_step(step: WorkflowStep) -> StepOutput | None:
    if isinstance(step, StepStringsCpos):
        return StepOutput(op=step.op, value=string_oracle.search(sp.cpos, step.text, step.chars, step.start))

    if isinstance(step, StepStringsCposr):
        return StepOutput(op=step.op, value=string_oracle.search(sp.cposr, step.text, step.chars, step.start))

    if isinstance(step, StepStringsNcpos):
        return StepOutput(op=step.op, value=string_oracle.search(sp.ncpos, step.text, step.chars, step.start))

    if isinstance(step, StepStringsNcposr):
        return StepOutput(op=step.op, value=string_oracle.search(sp.ncposr, step.text, step.chars, step.start))

    if isinstance(step, StepStringsPos):
        return StepOutput(op=step.op, value=string_oracle.search(sp.pos, step.text, step.substr, step.start))

    if isinstance(step, StepStringsPosr):
        return StepOutput(op=step.op, value=string_oracle.search(sp.posr, step.text, step.substr, step.start))

    if isinstance(step, StepStringsEsrchc):
        return StepOutput(op=step.op, value=string_oracle.esrchc(step.value, step.values))

    if isinstance(step, StepStringsCmprss):
        return StepOutput(op=step.op, value=string_oracle.cmprss(step.delim, step.n, step.input, step.lenout))

    if isinstance(step, StepStringsEqstr):
        string_oracle.validate_text(step.a, step.b)
        return StepOutput(op=step.op, value=sp.eqstr(step.a, step.b))

    if isinstance(step, StepStringsIswhsp):
        string_oracle.validate_text(step.input)
        return StepOutput(op=step.op, value=sp.iswhsp(step.input))

    if isinstance(step, StepStringsLastnb):
        string_oracle.validate_text(step.input)
        return StepOutput(op=step.op, value=sp.lastnb(step.input))

    if isinstance(step, StepStringsLcase):
        return StepOutput(op=step.op, value=string_oracle.lcase(step.input, step.lenout))

    if isinstance(step, StepStringsUcase):
        return StepOutput(op=step.op, value=string_oracle.ucase(step.input, step.lenout))

    if isinstance(step, StepStringsMatchi):
        string_oracle.validate_text(step.input, step.template)
        string_oracle.single_byte(step.wstr)
        string_oracle.single_byte(step.wchr)
        return StepOutput(op=step.op, value=sp.matchi(step.input, step.template, step.wstr, step.wchr))

    if isinstance(step, StepStringsMatchw):
        string_oracle.validate_text(step.input, step.template)
        string_oracle.single_byte(step.wstr)
        string_oracle.single_byte(step.wchr)
        return StepOutput(op=step.op, value=sp.matchw(step.input, step.template, step.wstr, step.wchr))

    return None
