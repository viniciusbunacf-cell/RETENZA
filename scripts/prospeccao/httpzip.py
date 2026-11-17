"""Lê um .zip remoto por requisições de intervalo (Range), sem baixar o arquivo inteiro."""
import io, sys, zipfile, urllib.request, ssl

class HttpFile(io.RawIOBase):
    def __init__(self, url):
        self.url, self.pos = url, 0
        req = urllib.request.Request(url, method="HEAD")
        with urllib.request.urlopen(req, timeout=60) as r:
            self.size = int(r.headers["Content-Length"])
    def seekable(self): return True
    def readable(self): return True
    def tell(self): return self.pos
    def seek(self, off, whence=0):
        self.pos = off if whence == 0 else self.pos + off if whence == 1 else self.size + off
        return self.pos
    def read(self, n=-1):
        if n is None or n < 0: n = self.size - self.pos
        if n == 0 or self.pos >= self.size: return b""
        end = min(self.size, self.pos + n) - 1
        req = urllib.request.Request(self.url, headers={"Range": f"bytes={self.pos}-{end}"})
        with urllib.request.urlopen(req, timeout=300) as r:
            data = r.read()
        self.pos += len(data)
        return data
    def readinto(self, b):
        d = self.read(len(b)); b[:len(d)] = d; return len(d)

if __name__ == "__main__":
    url = sys.argv[1]
    z = zipfile.ZipFile(io.BufferedReader(HttpFile(url), buffer_size=1 << 20))
    for i in z.infolist():
        print(f"{i.filename}\t{i.file_size}\t{i.compress_size}\t{i.date_time}")
