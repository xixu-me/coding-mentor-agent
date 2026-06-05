---
id: practical-python-1.4
source_exercise_id: "1.4"
title: "Where is My Bus?"
section: "1.1 Python"
source_path: "01_Introduction/01_Python.md"
source_repo: "https://github.com/dabeaz-course/practical-python"
source_commit: "93dca856b41c61a0a0f85ae334116e4c125629ea"
student_visible_solution: false
has_private_solution: false
skip: false
---

# Exercise 1.4: Where is My Bus?

> Source: Practical Python Programming, `01_Introduction/01_Python.md`.

### Exercise 1.4: Where is My Bus?

Note: This was a whimsical example that was a real crowd-pleaser when
I taught this course in my office.  You could query the bus and then
literally watch it pass by the window out front.  Sadly, APIs rarely live
forever and it seems that this one has now ridden off into the sunset. --Dave

Update: GitHub user @asett has suggested the following modified code might work,
but you'll have to provide your own API key (available [here](https://www.transitchicago.com/developers/bustracker/)).

```python
import urllib.request
u = urllib.request.urlopen('http://www.ctabustracker.com/bustime/api/v2/getpredictions?key=REDACTED_PLACEHOLDER&rt=22&stpid=14791')
from xml.etree.ElementTree import parse
doc = parse(u)
print("Arrival time in minutes:")
for pt in doc.findall('.//prdctdn'):
        print(pt.text)
```

(Original exercise example follows below)

Try something more advanced and type these statements to find out how
long people waiting on the corner of Clark street and Balmoral in
Chicago will have to wait for the next northbound CTA \#22 bus:

```python
>>> import urllib.request
>>> u = urllib.request.urlopen('http://ctabustracker.com/bustime/map/getStopPredictions.jsp?stop=14791&route=22')
>>> from xml.etree.ElementTree import parse
>>> doc = parse(u)
>>> for pt in doc.findall('.//pt'):
        print(pt.text)

6 MIN
18 MIN
28 MIN
>>>
```

Yes, you just downloaded a web page, parsed an XML document, and
extracted some useful information in about 6 lines of code. The data
you accessed is actually feeding the website
<http://ctabustracker.com/bustime/home.jsp>. Try it again and watch
the predictions change.

Note: This service only reports arrival times within the next 30 minutes.
If you're in a different timezone and it happens to be 3am in Chicago, you
might not get any output.  You use the tracker link above to double check.

If the first import statement `import urllib.request` fails, you’re
probably using Python 2. For this course, you need to make sure you’re
using Python 3.6 or newer. Go to <https://www.python.org> to download
it if you need it.

If your work environment requires the use of an HTTP proxy server, you may need
to set the `HTTP_PROXY` environment variable to make this part of the
exercise work. For example:

```python
>>> import os
>>> os.environ['HTTP_PROXY'] = 'http://yourproxy.server.com'
>>>
```

If you can't make this work, don't worry about it.  The rest of this course
has nothing to do with parsing XML.

[Contents](../Contents.md) \| [Next (1.2 A First Program)](02_Hello_world.md)

## 关联来源

- [[summaries/01_Python]]
