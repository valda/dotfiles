## -*- mode: sh; coding: utf-8-unix -*-

umask 022

if [ -z $USER ]; then
    export USER=$LOGNAME
fi

export LANG=ja_JP.UTF-8
export LANGUAGE=ja
export EDITOR=vi
export PAGER=less
export BLOCKSIZE=K
export PERL_BADLANG=0
export PGPPATH=$HOME/.pgp
export NETHACKOPTIONS="noautopickup"
export GREP_COLOR="01;34"
export LV='-Ou8 -c'
export TZ='JST-9'
export GISTY_DIR=$HOME/wc/gists
export DISABLE_AUTO_TITLE=true
#export GST_TAG_ENCODING=CP932
#export GST_ID3_TAG_ENCODING=CP932
if [ -x /usr/share/source-highlight/src-hilite-lesspipe.sh ]
    then
    export LESS='-R -j5 --no-init'
    export LESSOPEN='| /usr/share/source-highlight/src-hilite-lesspipe.sh %s'
fi
export GOPATH=$HOME/.go
#export GTAGSLABEL=pygments
export PATH=$HOME/opt/global/bin:$HOME/bin:$PATH:$GOPATH/bin
if [ -e /usr/bin/java ]; then
    export JAVA_HOME=$(readlink -f /usr/bin/java | sed -r "s:(jre/)?bin/java::")
fi

case "$OSTYPE" in
    cygwin)
        export CYGWIN=acl
        ;;
    *)
        limit coredumpsize 0
        ;;
esac

#-------------------------------------------------------------------------
# local::lib
#-------------------------------------------------------------------------
if [ -d "$HOME/perl5/lib/perl5" ]; then
    eval $(perl -I ~/perl5/lib/perl5/ -Mlocal::lib)
fi

#-------------------------------------------------------------------------
# rbenv
#-------------------------------------------------------------------------
if [ -d "$HOME/.rbenv" ]; then
    export PATH="$HOME/.rbenv/bin:$PATH"
    eval "$(rbenv init -)"
fi

#-------------------------------------------------------------------------
# nodenv
#-------------------------------------------------------------------------
export NODENV_ROOT=$HOME/.nodenv
if [ -d "$NODENV_ROOT" ]; then
    export PATH="$NODENV_ROOT/bin:$PATH"
    eval "$(nodenv init -)"
fi

#-------------------------------------------------------------------------
# nodebrew
#-------------------------------------------------------------------------
#if [ -d "$HOME/.nodebrew" ]; then
#    export PATH=$HOME/.nodebrew/current/bin:$PATH
#    export NODEBREW_ROOT=$HOME/.nodebrew
#fi

#-------------------------------------------------------------------------
# composer
#-------------------------------------------------------------------------
if [ -d "$HOME/.composer" ]; then
    alias composer=$HOME/.composer/composer.phar
    export PATH=$HOME/.composer/vendor/bin:$PATH
fi

#-------------------------------------------------------------------------
if [ -e $HOME/.zshenv.local ]; then
    source $HOME/.zshenv.local
fi
