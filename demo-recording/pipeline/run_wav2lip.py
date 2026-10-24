from pathlib import Path
import os,sys
root=Path(os.environ.get('WAV2LIP_HOME', str(Path.home()/'.cache/kris-lipsync/Wav2Lip')))
sys.path.insert(0,str(root))
import torch,librosa
original_mel=librosa.filters.mel
def compatible_mel(sr=None,n_fft=None,**kwargs):
    return original_mel(sr=sr,n_fft=n_fft,**kwargs)
librosa.filters.mel=compatible_mel
from face_detection.detection.core import FaceDetector
def init_detector(self,device,verbose):
    self.device=device
    self.verbose=verbose
FaceDetector.__init__=init_detector
source=(root/'inference.py').read_text()
source=source.replace("device = 'cuda' if torch.cuda.is_available() else 'cpu'", "device = 'cuda' if torch.cuda.is_available() else ('mps' if torch.backends.mps.is_available() else 'cpu')")
source=source.replace("predictions.extend(detector.get_detections_for_batch(np.array(images[i:i + batch_size])))", "batch = images[i:i + batch_size]\n\t\t\t\tscale = min(1.0, 360.0 / max(batch[0].shape[:2]))\n\t\t\t\tsmall = np.array([cv2.resize(im, (int(im.shape[1]*scale), int(im.shape[0]*scale))) for im in batch])\n\t\t\t\tdetected = detector.get_detections_for_batch(small)\n\t\t\t\tpredictions.extend([None if rect is None else tuple(int(v / scale) for v in rect) for rect in detected])")
source=source.replace("command = 'ffmpeg -y -i {} -i {} -strict -2 -q:v 1 {}'.format(args.audio, 'temp/result.avi', args.outfile)", "command = ['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', args.audio, '-i', 'temp/result.avi', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-c:a', 'aac', args.outfile]")
source=source.replace("subprocess.call(command, shell=platform.system() != 'Windows')", "subprocess.run(command, check=True)")
work_dir=Path(os.environ.get('WAV2LIP_WORK_DIR', str(Path.cwd()))).resolve()
work_dir.mkdir(parents=True,exist_ok=True)
os.chdir(work_dir)
Path('temp').mkdir(exist_ok=True)
exec(compile(source,str(root/'inference.py'),'exec'),{'__name__':'__main__','__file__':str(root/'inference.py')})
