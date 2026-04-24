// Proxy DLL forwarders for dwmapi.
//
// MSVC's /EXPORT linker option recognises `name=module.exportname` as a
// forwarder — but the equivalent syntax in a .def file EXPORTS section is
// treated as a local alias and fails with LNK2001 for every symbol. So we
// emit the forwarders via #pragma comment(linker, ...) here instead.
//
// Target module `dwmapi_orig.dll` is created on first load by DllMain (see
// dllmain.cpp) from %SystemRoot%\System32\dwmapi.dll. The game folder is
// searched ahead of System32, so Windows resolves our forwarders against the
// local copy and the real implementation runs transparently.

#define NB_FORWARD(name) \
  __pragma(comment(linker, "/EXPORT:" #name "=dwmapi_orig." #name))

NB_FORWARD(DwmAttachMilContent)
NB_FORWARD(DwmDefWindowProc)
NB_FORWARD(DwmDetachMilContent)
NB_FORWARD(DwmEnableBlurBehindWindow)
NB_FORWARD(DwmEnableComposition)
NB_FORWARD(DwmEnableMMCSS)
NB_FORWARD(DwmExtendFrameIntoClientArea)
NB_FORWARD(DwmFlush)
NB_FORWARD(DwmGetColorizationColor)
NB_FORWARD(DwmGetCompositionTimingInfo)
NB_FORWARD(DwmGetGraphicsStreamClient)
NB_FORWARD(DwmGetGraphicsStreamTransformHint)
NB_FORWARD(DwmGetTransportAttributes)
NB_FORWARD(DwmGetUnmetTabRequirements)
NB_FORWARD(DwmGetWindowAttribute)
NB_FORWARD(DwmInvalidateIconicBitmaps)
NB_FORWARD(DwmIsCompositionEnabled)
NB_FORWARD(DwmModifyPreviousDxFrameDuration)
NB_FORWARD(DwmQueryThumbnailSourceSize)
NB_FORWARD(DwmRegisterThumbnail)
NB_FORWARD(DwmRenderGesture)
NB_FORWARD(DwmSetDxFrameDuration)
NB_FORWARD(DwmSetIconicLivePreviewBitmap)
NB_FORWARD(DwmSetIconicThumbnail)
NB_FORWARD(DwmSetPresentParameters)
NB_FORWARD(DwmSetWindowAttribute)
NB_FORWARD(DwmShowContact)
NB_FORWARD(DwmTetherContact)
NB_FORWARD(DwmTransitionOwnedWindow)
NB_FORWARD(DwmUnregisterThumbnail)
NB_FORWARD(DwmUpdateThumbnailProperties)

#undef NB_FORWARD
