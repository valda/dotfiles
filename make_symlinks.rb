#!/usr/bin/env ruby

require 'optparse'
require 'pathname'
require 'pp'

force = false

ARGV.options do |opt|
  opt.banner = "Usage: #{File.basename($0)} [option]"
  opt.on("--help", "Print this message and quit.") { puts opt; exit 0 }
  opt.on("-f", "--force", "Force overwrite when file exist.") { force = true }
  opt.parse!
end

home = Pathname.new(ENV['HOME'])
dotfiles = Pathname.new(__FILE__).realpath.dirname.expand_path
puts "Source dir: #{dotfiles}"
dotfiles.each_entry do |entry|
  if (%w!. .. .svn .git! + [File.basename(__FILE__)]).include? entry.to_s
    puts "Skip: #{entry}"
    next
  end
  newlink = home+entry
  # リンク先が既に存在しているか？
  if newlink.exist?
    next if (newlink.symlink? and newlink.readlink.realpath == (dotfiles+entry).realpath)
    puts "#{newlink} is exists."
    next unless force
    # バックアップを作成
    bak = Pathname.new(newlink.to_s+'.bak')
    if bak.exist?
      if bak.directory?
        bak.rmtree
      else
        bak.unlink
      end
    end
    newlink.rename(bak)
  end
  newlink.make_symlink(dotfiles+entry)
  puts "Make symlink: #{newlink} -> #{dotfiles+entry}"
end

home.each_entry do |entry|
  file = (home+entry).expand_path
  if file.symlink? and not file.exist?
    file.unlink
    puts "Remove symlink: #{file}"
  end
end
