from io import BytesIO
import pyaudio
from pydub import AudioSegment
import base64

import sys
import threading

def eprint(*args, **kwargs):
    print(*args, file=sys.stderr, **kwargs)
    sys.stderr.flush()

FORMAT = pyaudio.paInt16
CHANNELS = 2
RATE = 44100
CHUNK = 1024
RECORD_SECONDS = 60
SAMPWIDTH = 2
CHUNKSPERSECOND = RATE/CHUNK

class RecorderThread (threading.Thread):
    def __init__(self):
        threading.Thread.__init__(self)
        # self.threadID = threadID
        self.scheduleKill = False
        self.frames = []
        self.buffer = []
        self.audio = pyaudio.PyAudio()
        self.lock = threading.Lock()
    def run(self):
        # start Recording
        self.lock.acquire()
        stream = self.audio.open(format=FORMAT, channels=CHANNELS,
                        rate=RATE, input=True,
                        frames_per_buffer=CHUNK,
                        input_device_index = 2)
        self.lock.release()
        while True:
            self.lock.acquire()
            data = stream.read(CHUNK)
            self.buffer.append(data)
            if len(self.buffer) > CHUNKSPERSECOND:
                self.saveBuffer()
                self.buffer = []
                
            if len(self.frames) > 300:
                newFirst = len(self.frames) - 300
                self.frames = self.frames[newFirst:]
            if self.scheduleKill:
                break
            self.lock.release()

        stream.stop_stream()
        stream.close()
        self.audio.terminate()
        self.lock.release()
    def saveBuffer(self):
        bufferjoin = b''.join(self.buffer)
        sound = AudioSegment.from_file(BytesIO(bufferjoin), format="raw", sample_width=SAMPWIDTH, frame_rate=RATE, channels=CHANNELS)
        self.frames.append(sound)
    def saveAudio(self):
        eprint("Save audio")   
        self.lock.acquire()
        sounds = self.frames
        if len(sounds) <= 0:
            self.lock.release()
            eprint("Sounds array is empty (wait for 1 sec and try again)\n")
            return b"\0"
        sounds_sum = sounds[0]
        sounds_len = len(sounds)
        eprint("Sum audio")
        for i in range(1, sounds_len):
            sounds_sum = sounds_sum + sounds[i]
        eprint("Summed audio")
        compressedSound = BytesIO()
        sounds_sum.export(compressedSound, format="mp3")
        eprint("Exported audio")
        data = compressedSound.read()
        self.lock.release()
        eprint("Send audio")
        # return data
        return base64.b64encode(data)

    def kill(self):
        self.lock.acquire()
        self.scheduleKill = True
        self.lock.release()


def main():
    
    rec = RecorderThread()
    rec.start()
    while not False:
        i = input()
        if i == 's':
            data = rec.saveAudio()
            # print(data.decode("utf-8"))
            sys.stdout.buffer.write(data)
            # sys.stdout.write("\n")
            sys.stdout.flush()

        if i == 'q':
            rec.kill()
            rec.join()
            break

if __name__== "__main__":
    main()
