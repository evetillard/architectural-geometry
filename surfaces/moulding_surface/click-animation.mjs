function render({ model, el }) {
  const image = document.createElement("img");
  const video = document.createElement("video");

  image.src = model.get("poster");
  image.alt = model.get("alt") || "Click to play the animation";

  video.src = model.get("src");
  video.preload = "metadata";
  video.muted = true;
  video.playsInline = true;
  video.style.display = "none";

  [image, video].forEach((media) => {
    Object.assign(media.style, {
      width: "70%",
      maxWidth: "700px",
      height: "auto",
      margin: "20px auto",
      cursor: "pointer"
    });
  });

  const showImage = () => {
    video.pause();
    video.currentTime = 0;
    video.style.display = "none";
    image.style.display = "block";
  };

  const showVideo = async () => {
    image.style.display = "none";
    video.style.display = "block";

    try {
      await video.play();
    } catch (error) {
      console.error("The video could not be played:", error);
      showImage();
    }
  };

  image.addEventListener("click", showVideo);
  video.addEventListener("click", showImage);
  video.addEventListener("ended", showImage);

  video.addEventListener("error", () => {
    console.error("Video loading error:", video.error);
    showImage();
  });

  el.append(image, video);

  return () => {
    image.removeEventListener("click", showVideo);
    video.removeEventListener("click", showImage);
    video.removeEventListener("ended", showImage);
    image.remove();
    video.remove();
  };
}

export default { render };