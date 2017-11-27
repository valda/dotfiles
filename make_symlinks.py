#!/usr/bin/env python2

import os
from optparse import OptionParser

parser = OptionParser()
parser.add_option('-f', '--force', action='store_true', dest='force',
                  help='Force overwrite when file exist.')
(options, args) = parser.parse_args()

home = os.path.expanduser('~')
dotfiles = os.path.dirname(os.path.realpath(__file__))
print 'Source dir: %s' % dotfiles
for entry in os.listdir(dotfiles):
    srcfile = os.path.join(dotfiles, entry)
    if entry in ['.', '..', '.svn', '.git', os.path.basename(__file__)]:
        print 'Skip: %s' % entry
        continue
    newlink = os.path.join(home, entry)
    if os.path.exists(newlink):
        if (os.path.islink(newlink) and
            os.path.realpath(newlink) == os.path.realpath(srcfile)):
            continue
        print '%s is exists.' % newlink
        if options.force:
            bak = newlink + '.bak'
            if os.path.exists(bak):
                os.remove(bak)
            os.rename(newlink, bak)
    os.symlink(srcfile, newlink)
    print "Make symlink: %s -> %s" % (newlink, os.path.join(dotfiles, entry))

for entry in os.listdir(home):
    homefile = os.path.join(home, entry)
    if os.path.islink(homefile) and not os.path.exists(homefile):
        os.remove(homefile)
        print 'remove symlink: %s' % homefile
