export async function processCreatePhotos(files, removeBackground) {
  const cutouts = []
  for (const file of files) {
    cutouts.push(await removeBackground(file))
  }
  return cutouts
}
