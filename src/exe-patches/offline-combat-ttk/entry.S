/* Cave entry and import stubs. Linked first, at offset 0 of the cave code.
 * The hook in the duel function does: mov rcx,r14 (attacker); mov rdx,rdi (target); call entry.
 * entry keeps every volatile register except rax/rcx/xmm0/xmm1 (the vanilla roll block clobbers
 * those itself), so the code around the hook sees no difference beyond the result in eax. */
    .intel_syntax noprefix
    .section .text.entry, "ax"
    .globl entry
entry:
    push rbp
    mov rbp, rsp
    push rdx
    push r8
    push r9
    push r10
    push r11
    and rsp, -16
    sub rsp, 0x60
    movaps [rsp + 0x20], xmm2
    movaps [rsp + 0x30], xmm3
    movaps [rsp + 0x40], xmm4
    movaps [rsp + 0x50], xmm5
    call duel
    movaps xmm2, [rsp + 0x20]
    movaps xmm3, [rsp + 0x30]
    movaps xmm4, [rsp + 0x40]
    movaps xmm5, [rsp + 0x50]
    lea rsp, [rbp - 0x28]
    pop r11
    pop r10
    pop r9
    pop r8
    pop rdx
    pop rbp
    ret

/* Import stubs: the patch script writes each rel32 to point at the located game address.
 * Function stubs are `jmp rel32` (e9); data stubs are `lea rax,[rip+rel32]; ret` (48 8d 05 .. c3). */
    .macro JSTUB name
    .globl \name
    .p2align 3
\name:
    .byte 0xe9
    .long 0
    .endm
    .macro DSTUB name
    .globl \name
    .p2align 3
\name:
    .byte 0x48, 0x8d, 0x05
    .long 0
    ret
    .endm

    JSTUB name_addref
    JSTUB proto_lookup
    JSTUB weapon_attr
    JSTUB weapon_settings
    JSTUB set_hp
    DSTUB p_srand_seed
    DSTUB p_item_pool
    DSTUB p_name_pool
