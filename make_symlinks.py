#!/usr/bin/env python

from os import path, listdir, remove, rename, symlink
from optparse import OptionParser
import re

parser = OptionParser()
parser.add_option('-f', '--force', action='store_true', dest='force',
                  help='Force overwrite when file exist.')
(options, args) = parser.parse_args()

def is_skip(entry):
    if entry in ['.', '..', '.svn', '.git', path.basename(__file__)]:
        return True
    if [1 for pattern in [r'#.*#', r'\.#.*', r'.*~'] if re.match(pattern, entry)]:
        return True
    return False

home = path.expanduser('~')
dotfiles = path.dirname(path.realpath(__file__))
print('Source dir: %s' % dotfiles)
for entry in listdir(dotfiles):
    if is_skip(entry):
        print('Skip: %s' % entry)
        continue
    srcfile = path.join(dotfiles, entry)
    newlink = path.join(home, entry)
    if path.exists(newlink):
        if (path.islink(newlink) and
            path.realpath(newlink) == path.realpath(srcfile)):
            continue
        print('%s is exists.' % newlink)
        if options.force:
            bak = newlink + '.bak'
            if path.exists(bak):
                remove(bak)
            rename(newlink, bak)
    else:
        print("Make symlink: %s -> %s" % (newlink, srcfile))
        symlink(srcfile, newlink)

for entry in listdir(home):
    homefile = path.join(home, entry)
    if path.islink(homefile) and not path.exists(homefile):
        remove(homefile)
        print('remove symlink: %s' % homefile)
