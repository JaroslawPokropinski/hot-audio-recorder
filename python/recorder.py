from io import BytesIO
import pyaudio
from pydub import AudioSegment
import base64

import threading

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
        self.lock.acquire()
        sounds = self.frames
    
        if len(sounds) <= 0:
            print("Sounds array is empty (wait for 1 sec and try again)")
            return
        sounds_sum = sounds[0]
        sounds_len = len(sounds)
        for i in range(1, sounds_len):
            sounds_sum = sounds_sum + sounds[i]
        compressedSound = BytesIO()
        sounds_sum.export(compressedSound, format="mp3")
        data = compressedSound.read()
        self.lock.release()
        return base64.b64encode(data)

    def kill(self):
        self.lock.acquire()
        self.scheduleKill = True
        self.lock.release()

def startRecording(sharedMemory):
    sharedMemory["lock"].acquire()
    # start Recording
    stream = sharedMemory["audio"].open(format=FORMAT, channels=CHANNELS,
                    rate=RATE, input=True,
                    frames_per_buffer=CHUNK,
                    input_device_index = 2)
    kl = sharedMemory["killSig"]
    sharedMemory["lock"].release()
    while not kl:
        sharedMemory["lock"].acquire()
        data = stream.read(CHUNK)
        sharedMemory["buffer"].append(data)
        if len(sharedMemory["buffer"]) > CHUNKSPERSECOND:
            saveBuffer(sharedMemory)
            sharedMemory["buffer"] = []
            
        if len(sharedMemory["frames"]) > 300:
            newFirst = len(sharedMemory["frames"]) - 300
            sharedMemory["frames"] = sharedMemory["frames"][newFirst:]
        
        kl = sharedMemory["killSig"]
        sharedMemory["lock"].release()

    stream.stop_stream()
    stream.close()
    sharedMemory["lock"].acquire()
    sharedMemory["audio"].terminate()  
    sharedMemory["lock"].release() 

def close(sharedMemory):
    sharedMemory["lock"].acquire()
    sharedMemory["killSig"] = True
    sharedMemory["lock"].release() 

def main():
    sharedMemory = {
        "lock": threading.Lock(),
        "killSig": False,
        "buffer": [],
        "frames": [],
        "audio" : pyaudio.PyAudio()
    }
    
    rec = RecorderThread()
    rec.start()
    while not False:
        i = input()
        if i == 's':
            data = rec.saveAudio()
            print(data.decode("utf-8"))
        if i == 'q':
            rec.kill()
            rec.join()
            break

if __name__== "__main__":
    main()
