export function getSwapPreviewView(hasPreview: boolean, isLoading: boolean) {
  if (hasPreview) return "preview"
  return isLoading ? "loading" : "empty"
}
