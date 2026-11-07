// Photos are shrunk on the phone before they are locked and uploaded. Drawing
// the picture again also drops everything hidden in the file, such as the
// location it was taken and the camera's details.
const MAX_SIDE = 1000;
export async function shrinkPhoto(file, maxSide = MAX_SIDE) {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx)
        throw new Error('No canvas');
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.8));
    if (!blob)
        throw new Error('Could not read the photo');
    return new Uint8Array(await blob.arrayBuffer());
}
